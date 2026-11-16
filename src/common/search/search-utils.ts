/**
 * Ajudantes de busca textual para as listagens da API.
 *
 * O usuário digita como fala ("cafe", "pao", "jose") e os dados são gravados
 * com acento ("Café", "Pão", "José"). Também é comum digitar "#12" ou um
 * caractere especial (parênteses de "Coco Vampiro (com vinho)").
 *
 * Regras:
 *  - escapa metacaracteres de regex (evita erro 500 e injeção de padrão);
 *  - trata vogais/ç/ñ com e sem acento como equivalentes;
 *  - limita o tamanho do termo para não gerar regex caro.
 */

const MAX_TERM_LENGTH = 80;

/** Caracteres que precisam de escape para serem literais em regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Classes de equivalência (sem acento -> com acentos usados em pt-BR).
const ACCENT_CLASSES: Record<string, string> = {
  a: 'aáàâãä',
  c: 'cç',
  e: 'eéèêë',
  i: 'iíìîï',
  n: 'nñ',
  o: 'oóòôõö',
  u: 'uúùûü',
  y: 'yýÿ',
};

function baseLetter(char: string): string | null {
  const base = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return base.length === 1 ? base.toLowerCase() : null;
}

/**
 * Converte o termo digitado em um padrão de regex literal e tolerante a
 * acentos. O resultado deve ser usado com a opção `i`.
 */
export function buildSearchRegex(term: string): string {
  const trimmed = term.trim().replace(/^#/, '').slice(0, MAX_TERM_LENGTH);
  let pattern = '';

  for (const char of Array.from(trimmed)) {
    const base = baseLetter(char);
    const chars = base ? ACCENT_CLASSES[base] : undefined;
    if (chars) {
      // Inclui maiúsculas na própria classe para não depender do collation.
      pattern += `[${chars}${chars.toUpperCase()}]`;
    } else {
      pattern += escapeRegex(char);
    }
  }

  return pattern;
}

/** Termo pesquisável (sem `#`, sem espaços sobrando) ou `null`. */
export function normalizeSearchTerm(term?: string | null): string | null {
  const trimmed = term?.trim().replace(/^#/, '') ?? '';
  return trimmed ? trimmed.slice(0, MAX_TERM_LENGTH) : null;
}
