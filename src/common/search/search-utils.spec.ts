import { describe, it, expect } from 'vitest';
import { buildSearchRegex, escapeRegex, normalizeSearchTerm } from './search-utils';

describe('search-utils', () => {
  it('escapa metacaracteres de regex', () => {
    expect(buildSearchRegex('(')).toBe('\\(');
    expect(buildSearchRegex('.*')).toBe('\\.\\*');
    expect(escapeRegex('a+b(c)[d]')).toBe('a\\+b\\(c\\)\\[d\\]');
  });

  it('trata acentos como equivalentes nos dois sentidos', () => {
    expect(buildSearchRegex('cafe')).toBe('[cçCÇ][aáàâãäAÁÀÂÃÄ]f[eéèêëEÉÈÊË]');
    expect(buildSearchRegex('Café')).toBe('[cçCÇ][aáàâãäAÁÀÂÃÄ]f[eéèêëEÉÈÊË]');
    expect(buildSearchRegex('pao')).toContain('[aáàâãäAÁÀÂÃÄ]');
    expect(buildSearchRegex('jose')).toContain('[oóòôõöOÓÒÔÕÖ]');
  });

  it('ignora o # inicial e espaços', () => {
    expect(normalizeSearchTerm('  #12 ')).toBe('12');
    expect(normalizeSearchTerm('   ')).toBeNull();
    expect(normalizeSearchTerm(undefined)).toBeNull();
  });

  it('limita o tamanho do termo', () => {
    expect(normalizeSearchTerm('a'.repeat(200))).toHaveLength(80);
  });
});
