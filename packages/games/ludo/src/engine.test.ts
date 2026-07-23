import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  __test_setPendingDice,
  applyLudoAction,
  computeDestination,
  createLudoState,
  getMovableTokens,
  validateLudoAction,
} from './engine.js';
import { ENTRY_INDEX } from './board.js';
import { rollSecureDie, verifyDiceRoll as verify } from './dice.js';

describe('Ludo board math', () => {
  it('leaves yard only on 6', () => {
    const yard = { kind: 'yard' as const, slot: 0 };
    assert.equal(computeDestination('red', yard, 5), null);
    assert.deepEqual(computeDestination('red', yard, 6), {
      kind: 'track',
      index: ENTRY_INDEX.red,
    });
  });

  it('moves on track and enters home stretch', () => {
    const near = { kind: 'track' as const, index: 50 }; // red pre-home
    assert.deepEqual(computeDestination('red', near, 1), { kind: 'home', index: 0 });
    assert.deepEqual(computeDestination('red', near, 6), { kind: 'home', index: 5 });
    assert.equal(computeDestination('red', near, 7), null);
  });
});

describe('Ludo engine', () => {
  it('creates 2–4 player state', () => {
    const s = createLudoState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
      options: { matchId: 'm1' },
    });
    assert.equal(s.players.length, 2);
    assert.equal(s.players[0]!.tokens.length, 4);
    assert.equal(s.currentSeat, 0);
  });

  it('rejects move out of turn', () => {
    const s = createLudoState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
      options: { matchId: 'm1' },
    });
    const v = validateLudoAction(s, { type: 'roll' }, 'b');
    assert.equal(v.ok, false);
  });

  it('rolls secure dice and allows exit on 6', () => {
    let s = createLudoState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
      options: { matchId: 'm1' },
    });
    // Force a 6 pending
    s = __test_setPendingDice(s, 6);
    const movable = getMovableTokens(s, 'a');
    assert.ok(movable.length === 4);
    const { state, events } = applyLudoAction(s, { type: 'move', tokenIndex: 0 });
    assert.equal(state.players[0]!.tokens[0]!.kind, 'track');
    assert.ok(events.some((e) => e.type === 'move'));
  });

  it('signs dice rolls', () => {
    const secret = 'abc';
    const roll = rollSecureDie(secret, 'm', 1);
    assert.ok(verify(secret, 'm', 1, roll));
    assert.ok(!verify(secret, 'm', 2, roll));
  });

  it('captures opponent on unsafe square', () => {
    let s = createLudoState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
      options: { matchId: 'm1' },
    });
    // Place red token on track 1, green on track 1 (unsafe)
    s.players[0]!.tokens[0] = { kind: 'track', index: 1 };
    s.players[1]!.tokens[0] = { kind: 'track', index: 2 };
    s = __test_setPendingDice(s, 1);
    // move red from 1 → 2, capture green
    const { state, events } = applyLudoAction(s, { type: 'move', tokenIndex: 0 });
    assert.equal(state.players[0]!.tokens[0]!.kind, 'track');
    assert.deepEqual(state.players[1]!.tokens[0], { kind: 'yard', slot: 0 });
    assert.ok(events.some((e) => e.type === 'capture'));
    // extra turn after capture
    assert.equal(state.currentSeat, 0);
  });
});
