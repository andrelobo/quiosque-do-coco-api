#!/usr/bin/env node
/**
 * Regressão do fluxo de venda (API Quiosque do Coco).
 *
 * Cobre:
 *  - login por cookie httpOnly;
 *  - abertura automática de turno quando não existe turno aberto;
 *  - criação de pedido e envio para pagamento (reserva de estoque);
 *  - rejeições: pagamento antes do submit, valor divergente, turno divergente,
 *    cartão sem tipo;
 *  - pagamento em dinheiro (troco) e confirmação via /payments/:id/confirm;
 *  - idempotência da confirmação (payments e orders);
 *  - pagamento Pix e confirmação via /orders/:id/confirm-payment;
 *  - status final: PRONTO (sem preparo) ou PAGO (com preparo);
 *  - resumo de caixa (/reports/cash/:shiftId) com Pix/Cartão;
 *  - endpoint /audit/logs;
 *  - fechamento do turno com expected/difference persistidos (somente quando o
 *    turno foi aberto pelo próprio script);
 *  - limpeza dos dados de teste (cancelamento + remoção no Mongo).
 *
 * Uso:
 *   API_URL=http://localhost:4000 node scripts/smoke-sale-flow.mjs
 *   ... --keep   (não limpa os dados; útil para inspecionar)
 *
 * Observação: o script precisa do Mongo para a limpeza final. Use
 * MONGODB_URI para apontar para outro banco (recomendado: banco de teste).
 */
import mongoose from 'mongoose';

const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/quiosque';
const KEEP = process.argv.includes('--keep');

let cookie = '';
let shiftWasAutoOpened = false;
const createdOrderIds = [];
const createdPaymentIds = [];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function closeTo(actual, expected, tolerance = 0.01) {
  return Math.abs(round2(actual) - round2(expected)) <= tolerance;
}

function step(name, detail = '') {
  console.log(`${green('✓')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

async function request(method, path, body, expectedStatus) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(';')[0];
    if (pair.startsWith('auth_token=')) cookie = pair;
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (expectedStatus !== undefined) {
    const preview = typeof data === 'string' ? data : JSON.stringify(data);
    assert(
      res.status === expectedStatus,
      `${method} ${path} esperava HTTP ${expectedStatus}, recebeu ${res.status}: ${preview}`,
    );
  }
  return { status: res.status, data };
}

function pickAvailable(availability, predicate, preferTracked = false) {
  const candidates = availability.filter((a) => a.available && a.product);
  if (preferTracked) {
    return (
      candidates.find((a) => predicate(a.product) && a.product.trackStock) ||
      candidates.find((a) => predicate(a.product))
    );
  }
  // Prefere produtos sem controle de estoque para não mexer no inventário.
  return (
    candidates.find((a) => predicate(a.product) && !a.product.trackStock) ||
    candidates.find((a) => predicate(a.product))
  );
}

async function ensureShift() {
  const { data: current } = await request('GET', '/shifts/current', undefined, 200);
  if (current?.id) {
    step('Turno aberto encontrado', `#${current.number}`);
    return current;
  }

  const { data: products } = await request('GET', '/products?includeInactive=false', undefined, 200);
  assert(products.length > 0, 'Nenhum produto ativo para abrir turno');
  await request(
    'POST',
    '/shifts/open',
    { initialCash: 100, productIds: products.map((p) => p.id) },
    201,
  );
  shiftWasAutoOpened = true;
  // A resposta do open não popula availability.product; busca o turno completo.
  const { data: opened } = await request('GET', '/shifts/current', undefined, 200);
  assert(opened?.id, 'Turno aberto não encontrado após abertura');
  step('Turno aberto pelo script', `#${opened.number}`);
  return opened;
}

async function payAndConfirm(order, product, method) {
  const total = order.totalCents; // resposta já vem em reais

  // 1. Pagamento antes do submit deve falhar.
  const beforeSubmit = await request(
    'POST',
    '/payments',
    { orderId: order.id, shiftId: order.shift, method: 'dinheiro', amount: total, received: total },
    400,
  );
  assert(
    String(beforeSubmit.data?.message || '').includes('aguardando pagamento'),
    'Pagamento antes do submit deveria ser recusado por status',
  );

  // 2. Enviar para pagamento (reserva de estoque).
  const { data: submitted } = await request('POST', `/orders/${order.id}/submit`, undefined, 201);
  assert(submitted.status === 'aguardando_pagamento', `Status após submit: ${submitted.status}`);

  // 3. Valor divergente deve falhar.
  await request(
    'POST',
    '/payments',
    { orderId: order.id, shiftId: order.shift, method: 'dinheiro', amount: round2(total - 1), received: total },
    400,
  );

  // 4. Turno divergente deve falhar.
  await request(
    'POST',
    '/payments',
    { orderId: order.id, shiftId: '000000000000000000000000', method: 'dinheiro', amount: total, received: total },
    400,
  );

  // 5. Cartão sem tipo deve falhar.
  await request(
    'POST',
    '/payments',
    { orderId: order.id, shiftId: order.shift, method: 'cartao', amount: total },
    400,
  );

  // 6. Pagamento válido.
  const paymentBody = {
    orderId: order.id,
    shiftId: order.shift,
    method,
    amount: total,
    ...(method === 'dinheiro' ? { received: round2(total + 5) } : {}),
  };
  const { data: payment } = await request('POST', '/payments', paymentBody, 201);
  createdPaymentIds.push(payment.id);
  assert(payment.status === 'pendente', `Pagamento deveria estar pendente, veio ${payment.status}`);
  if (method === 'dinheiro') {
    assert(closeTo(payment.changeCents, 5), `Troco esperado 5, recebido ${payment.changeCents}`);
  }

  const expectedStatus = product.requiresPrep ? 'pago' : 'pronto';

  if (method === 'dinheiro') {
    // Confirma pelo endpoint de pagamentos (caminho que antes engolia o erro).
    const { data: confirmedPayment } = await request(
      'PATCH',
      `/payments/${payment.id}/confirm`,
      undefined,
      200,
    );
    assert(confirmedPayment.status === 'confirmado', 'Pagamento não foi confirmado');

    // Idempotência: confirmar de novo não pode falhar nem duplicar estado.
    await request('PATCH', `/payments/${payment.id}/confirm`, undefined, 200);
    const { data: reConfirmed } = await request('POST', `/orders/${order.id}/confirm-payment`, undefined, 201);
    assert(reConfirmed.status === expectedStatus, `Reconfirmação alterou status para ${reConfirmed.status}`);
  } else {
    // Confirma pelo endpoint de pedidos.
    const { data: confirmedOrder } = await request('POST', `/orders/${order.id}/confirm-payment`, undefined, 201);
    assert(confirmedOrder.status === expectedStatus, `Status após confirmar: ${confirmedOrder.status}`);
    await request('POST', `/orders/${order.id}/confirm-payment`, undefined, 201);
  }

  const { data: finalOrder } = await request('GET', `/orders/${order.id}`, undefined, 200);
  assert(finalOrder.status === expectedStatus, `Status final esperado ${expectedStatus}, veio ${finalOrder.status}`);
  assert(!!finalOrder.paidAt, 'paidAt não preenchido');

  const { data: orderPayments } = await request('GET', `/payments/order/${order.id}`, undefined, 200);
  assert(
    orderPayments.every((p) => p.status === 'confirmado'),
    'Existe pagamento não confirmado no pedido',
  );

  return { total, expectedStatus };
}

async function cleanup() {
  if (KEEP) {
    console.log(dim('\n--keep: dados de teste mantidos.'));
    return;
  }
  if (createdOrderIds.length === 0) return;

  console.log(dim('\nLimpando dados de teste...'));
  for (const orderId of createdOrderIds) {
    try {
      // Cancelar libera a reserva de estoque antes de apagar os documentos.
      await request('POST', `/orders/${orderId}/cancel`, { reason: 'Limpeza do smoke test' }, 201);
    } catch {
      // Pedido pode já estar cancelado/entregue; segue para a remoção.
    }
  }

  if (trackedProductId && trackedBeforeQty !== null) {
    try {
      const { data: restored } = await request('GET', `/products/${trackedProductId}`, undefined, 200);
      assert(
        closeTo(restored.availableQty, trackedBeforeQty),
        `Estoque não restaurado: ${restored.availableQty} (esperado ${trackedBeforeQty})`,
      );
      console.log(green('✓') + ` Reserva de estoque liberada (disponível ${restored.availableQty})`);
    } catch (error) {
      console.error(red(`❌ ${error.message}`));
      process.exitCode = 1;
    }
  }

  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;
  const orderIds = createdOrderIds.map((id) => new mongoose.Types.ObjectId(id));
  const paymentIds = createdPaymentIds.map((id) => new mongoose.Types.ObjectId(id));

  await db.collection('payments').deleteMany({ order: { $in: orderIds } });
  await db.collection('stockmovements').deleteMany({ order: { $in: orderIds } });
  await db.collection('auditlogs').deleteMany({
    $or: [
      { entityId: { $in: [...orderIds, ...paymentIds] } },
      { 'meta.order': { $in: orderIds } },
    ],
  });
  await db.collection('orders').deleteMany({ _id: { $in: orderIds } });

  if (shiftWasAutoOpened && savedShiftId) {
    // O turno pode ter sido fechado pelo próprio teste; apaga pelo id.
    await db.collection('shifts').deleteOne({ _id: new mongoose.Types.ObjectId(savedShiftId) });
  }

  await mongoose.disconnect();
  console.log(green('✓') + ' Dados de teste removidos');
}

let savedShiftId = '';
let trackedProductId = '';
let trackedBeforeQty = null;

async function main() {
  console.log(dim(`API: ${API}\nMongo (limpeza): ${MONGO}\n`));

  const { data: login } = await request(
    'POST',
    '/auth/login',
    { username: process.env.SMOKE_USER || 'admin', password: process.env.SMOKE_PASSWORD || 'admin123' },
    200,
  );
  assert(!!cookie, 'Cookie auth_token não recebido no login');
  const loggedUser = login?.user || {};
  step('Login', `${loggedUser.name || loggedUser.username} (${loggedUser.role})`);

  const shift = await ensureShift();
  savedShiftId = shift.id;

  // A API hoje devolve `availability.product` apenas como id (o populate de
  // subdocumento não está funcionando), então cruza com /products.
  const { data: products } = await request('GET', '/products?includeInactive=false', undefined, 200);
  const productById = new Map(products.map((p) => [p.id, p]));
  const availability = (shift.availability || [])
    .filter((a) => a.available)
    .map((a) => {
      const productId = typeof a.product === 'string' ? a.product : a.product?.id;
      return { available: true, product: productById.get(productId) };
    })
    .filter((a) => a.product);

  const noPrep = pickAvailable(availability, (p) => p.requiresPrep === false, true);
  const withPrep = pickAvailable(availability, (p) => p.requiresPrep === true);
  assert(noPrep || withPrep, 'Nenhum produto disponível no turno para testar');

  // ---------- Pedido A: dinheiro ----------
  const productA = noPrep || withPrep;
  let trackedBefore = null;
  if (productA.product.trackStock) {
    const { data: before } = await request('GET', `/products/${productA.product.id}`, undefined, 200);
    trackedBefore = before.availableQty;
    trackedProductId = productA.product.id;
    trackedBeforeQty = before.availableQty;
  }
  const { data: orderA } = await request(
    'POST',
    '/orders',
    {
      shiftId: shift.id,
      items: [{ productId: productA.product.id, qty: 1 }],
      pickupName: 'Smoke Teste Dinheiro',
    },
    201,
  );
  createdOrderIds.push(orderA.id);
  step('Pedido criado (dinheiro)', `#${orderA.code} · ${productA.product.name} · ${orderA.totalCents} reais`);

  const resultA = await payAndConfirm(orderA, productA.product, 'dinheiro');
  step('Pagamento em dinheiro confirmado', `status ${resultA.expectedStatus}, troco de 5,00`);

  if (trackedBefore !== null) {
    const { data: after } = await request('GET', `/products/${productA.product.id}`, undefined, 200);
    assert(
      closeTo(after.availableQty, trackedBefore - 1),
      `Reserva não refletiu no estoque: ${trackedBefore} → ${after.availableQty}`,
    );
    step('Reserva de estoque ativa', `${productA.product.name}: disponível ${trackedBefore} → ${after.availableQty}`);
  }

  // ---------- Pedido B: Pix (se houver produto com preparo) ----------
  let resultB = null;
  if (withPrep) {
    const { data: orderB } = await request(
      'POST',
      '/orders',
      {
        shiftId: shift.id,
        items: [{ productId: withPrep.product.id, qty: 1 }],
        pickupName: 'Smoke Teste Pix',
      },
      201,
    );
    createdOrderIds.push(orderB.id);
    resultB = await payAndConfirm(orderB, withPrep.product, 'pix');
    step('Pagamento Pix confirmado', `status ${resultB.expectedStatus} · ${withPrep.product.name}`);
  } else {
    console.log(dim('• Nenhum produto com preparo disponível: teste Pix ignorado.'));
  }

  // ---------- Resumo de caixa ----------
  const { data: summary } = await request('GET', `/reports/cash/${shift.id}`, undefined, 200);
  assert(summary.cashReceivedCents >= resultA.total - 0.01, 'Resumo não inclui o dinheiro recebido');
  if (resultB) {
    assert(summary.pixCents >= resultB.total - 0.01, 'Resumo não inclui o Pix recebido');
  }
  assert(typeof summary.cardCents === 'number' && typeof summary.cardDebitCents === 'number', 'Resumo sem campos de cartão');
  step(
    'Resumo de caixa',
    `dinheiro ${summary.cashReceivedCents} · pix ${summary.pixCents} · cartão ${summary.cardCents} · total ${summary.totalSalesCents}`,
  );

  // ---------- Auditoria ----------
  const { data: auditLogs } = await request('GET', '/audit/logs?action=order.paid&entity=Order', undefined, 200);
  assert(Array.isArray(auditLogs), 'Resposta de auditoria inválida');
  assert(
    auditLogs.some((log) => log.entityId === orderA.id),
    'Log de auditoria order.paid não encontrado para o pedido',
  );
  step('Auditoria', `${auditLogs.length} log(s) order.paid`);

  // ---------- Fechamento persistido (só fecha turno criado pelo script) ----------
  if (shiftWasAutoOpened) {
    const counted = summary.expectedCashCents;
    const { data: closed } = await request(
      'POST',
      `/shifts/${shift.id}/close`,
      { countedCash: counted, closingNotes: 'Fechamento do smoke test' },
      201,
    );
    assert(closeTo(closed.expectedCashCents, summary.expectedCashCents), 'expectedCashCents não persistido');
    assert(closeTo(closed.differenceCents, 0), `differenceCents esperado 0, veio ${closed.differenceCents}`);

    const { data: reloaded } = await request('GET', `/shifts/${shift.id}`, undefined, 200);
    assert(closeTo(reloaded.expectedCashCents, summary.expectedCashCents), 'expectedCashCents não sobreviveu ao GET');
    assert(closeTo(reloaded.differenceCents, 0), 'differenceCents não sobreviveu ao GET');
    step('Fechamento de turno persistido', `esperado ${reloaded.expectedCashCents} · diferença ${reloaded.differenceCents}`);
  } else {
    console.log(dim('• Turno já existia: fechamento não executado (evita fechar caixa real).'));
  }

  console.log(green('\n✅ Fluxo de venda validado com sucesso.'));
}

main()
  .catch(async (error) => {
    console.error(red(`\n❌ Falha: ${error.message}`));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error(red(`❌ Falha na limpeza: ${error.message}`));
      process.exitCode = 1;
    }
  });
