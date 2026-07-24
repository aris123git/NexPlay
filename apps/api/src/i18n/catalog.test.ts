import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContinent, LOCALES, CURRENCIES } from '../i18n/catalog.js';

describe('i18n catalog', () => {
  it('resolves continents', () => {
    assert.equal(resolveContinent('BF'), 'AF');
    assert.equal(resolveContinent('FR'), 'EU');
    assert.equal(resolveContinent('US'), 'NA');
  });

  it('exposes core locales and currencies', () => {
    assert.ok(LOCALES.some((l) => l.code === 'fr'));
    assert.ok(LOCALES.some((l) => l.code === 'ar' && l.dir === 'rtl'));
    assert.ok(CURRENCIES.some((c) => c.code === 'XOF'));
  });
});
