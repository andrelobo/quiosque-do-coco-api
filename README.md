# Quiosque do Coco — API

API REST do sistema de PDV e gestão de turnos do Quiosque do Coco.
NestJS 12.4 + MongoDB (Mongoose) + JWT em cookie `httpOnly`.

- Repositório do frontend: `quiosque-do-coco-web`
- Documentação interativa: `/api/docs` (Swagger, 61 rotas)
- Estado detalhado: [`current_state.md`](./current_state.md) · contexto: [`context.md`](./context.md)

## Requisitos

- Node.js 22+ (CI e Dockerfile usam Node 22)
- MongoDB 7 (local via Docker ou Atlas em produção)

## Desenvolvimento

```bash
npm install
cp .env.example .env    # ajuste se necessário
npm run start:dev       # http://localhost:4000
```

O Mongo local deste ambiente roda num container `mongo:7`
(`docker start quiosque-mongodb` → `mongodb://localhost:27017`). O
`docker-compose.yml` deste repositório é o **de produção** (só a API, apontando
para o Atlas). Em produção usamos **MongoDB Atlas** — a API não roda banco de
dados na VPS.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `4000` | Porta da API |
| `NODE_ENV` | `development` | `production` ativa cookie `Secure` + `SameSite=None` |
| `MONGODB_URI` | `mongodb://localhost:27017/quiosque` | Conexão Mongo |
| `JWT_SECRET` | — | Obrigatório em produção |
| `JWT_EXPIRES` | `12h` | Validade do token |
| `BUSINESS_TIMEZONE` | `America/Sao_Paulo` | Fuso do negócio: dia do pedido, numeração de turno e relatórios |
| `FRONTEND_URL` | `http://localhost:5173` | Origem liberada no CORS (URL do Vercel em produção) |
| `SEED_ON_BOOT` | — | `false` desliga o seed automático; `true` força o seed mesmo em produção |

O boot cria usuários e produtos básicos se o banco estiver vazio
(`admin/admin123`, `responsavel/resp123`, `atendente/atend123`) — em
`NODE_ENV=production` isso só acontece com `SEED_ON_BOOT=true`.
**Troque essas senhas em produção.**

### Scripts

| Comando | Função |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compila para `dist/` |
| `npm run start:prod` | Executa `dist/main` |
| `npm test` | Vitest (6 suítes, 35 testes) |
| `npm run test:watch` | Vitest em watch |
| `npm run test:cov` | Vitest com cobertura |
| `npm run lint` | ESLint com `--fix` |
| `npm run lint:check` | ESLint só validando (CI) |
| `npm run smoke` | Regressão end-to-end do fluxo de venda (`scripts/smoke-sale-flow.mjs`) |
| `npm run seed:full` | Popula o banco com dados de demonstração (ts-node) |

## Módulos

`auth` (JWT em cookie, papéis admin/responsável/atendente) · `users` ·
`products` · `shifts` · `orders` · `payments` · `refunds` · `stock` · `cash` ·
`reports` · `audit` · `seed`.

## Busca e relatórios

- `GET /orders?status=&page=&limit=&search=` — busca e paginação **no servidor**.
  O termo ignora acento/caixa, o regex é escapado e um termo numérico casa
  somente `code` (nunca `dayKey`). Limites: `page >= 1`, `limit` entre 1 e 100.
- Relatórios de venda contam apenas pedidos pagos (`PAGO`, `EM_PREPARO`,
  `PRONTO`, `ENTREGUE`).
- Filtro de dia e agrupamento usam `BUSINESS_TIMEZONE`.
- `start`/`end` vazios caem no dia corrente (a tela abre com `?start=&end=`);
  data em formato inválido ou início > fim retorna **400**.

## Deploy na VPS (Docker + Caddy)

```bash
# no servidor, dentro do repositório
cp .env.example .env
# edite .env:
#   NODE_ENV=production
#   JWT_SECRET=<segredo forte>
#   FRONTEND_URL=https://<seu-projeto>.vercel.app
#   MONGODB_URI=<string do Atlas>

docker compose up -d --build
```

O container publica **apenas** `127.0.0.1:4000` e entra na rede externa `edge`,
compartilhada com o Caddy. O HTTPS fica com o Caddy:

```caddy
quiosque-api.seudominio.com {
    reverse_proxy quiosque-api:4000
}
```

### Deploy automático

O workflow `.github/workflows/deploy.yml` roda **depois** que o CI da `main`
conclui com sucesso (`workflow_run`), acessa a VPS por SSH e executa
`git pull` + `docker compose build api`. Também aceita `workflow_dispatch`.
Segredos necessários no repositório: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e
`VPS_APP_DIR` (ex.: `/home/ubuntu/quiosque-api`).

Como o frontend (Vercel) e a API (VPS) são sites diferentes, o cookie de sessão
usa `SameSite=None; Secure` em produção. Por isso a API **precisa** ser servida
por HTTPS e `FRONTEND_URL` deve ser a URL exata do Vercel.

## CI

`.github/workflows/ci.yml` roda em PRs e na `main`:

- `lint-test-build`: `npm ci` + `lint:check` + `vitest run` + `nest build`;
- `smoke`: sobe MongoDB 7 como service container, usa o banco descartável
  `quiosque_e2e` e executa `npm run smoke` contra a API compilada.

Dependabot semanal para npm (grupos `@nestjs/*` e dev tooling) e mensal para
GitHub Actions.

## Estado atual

- Autenticação e autorização por papel implementadas (matriz em
  `../acessos-por-perfil.md`).
- 61 rotas documentadas no Swagger.
- 6 suítes / 35 testes automatizados + smoke end-to-end no CI.
- Sem vulnerabilidades altas; restam 7 moderadas dev-only
  (`typescript-eslint` → `minimatch`), sem correção publicada.
