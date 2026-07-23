import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSingleElimBracket,
  nextPowerOfTwo,
} from './engine.js';

describe('Tournament Engine', () => {
  it('nextPowerOfTwo', () => {
    assert.equal(nextPowerOfTwo(3), 4);
    assert.equal(nextPowerOfTwo(8), 8);
    assert.equal(nextPowerOfTwo(9), 16);
  });

  it('builds single-elim bracket for 4 players', () => {
    const bracket = buildSingleElimBracket(['a', 'b', 'c', 'd']);
    const r1 = bracket.filter((n) => n.round === 1);
    const r2 = bracket.filter((n) => n.round === 2);
    assert.equal(r1.length, 2);
    assert.equal(r2.length, 1);
    assert.ok(r1.every((m) => m.status === 'ready'));
  });

  it('handles byes for 3 players', () => {
    const bracket = buildSingleElimBracket(['a', 'b', 'c']);
    const r1 = bracket.filter((n) => n.round === 1);
    assert.equal(r1.length, 2);
    assert.ok(r1.some((m) => m.status === 'bye' || m.winnerEntryId));
    const final = bracket.find((n) => n.round === 2);
    assert.ok(final);
    // bye winner should be placed in final
    assert.ok(final!.entryAId || final!.entryBId);
  });
});
