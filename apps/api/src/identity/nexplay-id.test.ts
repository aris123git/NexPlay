import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateNexplayId, nexplayTag } from './nexplay-id.js';

describe('NexPlay ID', () => {
  it('generates NXP-XXXX-XXXX', () => {
    const id = generateNexplayId();
    assert.match(id, /^NXP-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('builds display tag', () => {
    assert.equal(nexplayTag('Aristide', 'NXP-4F8A-29C1'), 'Aristide#29C1');
  });
});
