import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { idx, isDarkSquare, setupInitialBoard } from './board.js';
import {
  __test_clearBoard,
  __test_place,
  applyDamesAction,
  createDamesState,
  getLegalDamesActions,
  validateDamesAction,
} from './engine.js';

describe('Dames board', () => {
  it('uses dark squares only for pieces', () => {
    const board = setupInitialBoard();
    let pieces = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i]) {
        assert.ok(isDarkSquare(i));
        pieces++;
      }
    }
    assert.equal(pieces, 24);
  });
});

describe('Dames engine', () => {
  it('creates 2-player state, dark to move', () => {
    const s = createDamesState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
      options: { matchId: 'm1' },
    });
    assert.equal(s.currentSide, 'dark');
    assert.equal(s.sides.dark, 'a');
    assert.equal(s.sides.light, 'b');
  });

  it('rejects out-of-turn moves', () => {
    const s = createDamesState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
    });
    const legal = getLegalDamesActions(s, 'a');
    assert.ok(legal.length > 0);
    const v = validateDamesAction(s, legal[0]!, 'b');
    assert.equal(v.ok, false);
  });

  it('forces capture when available', () => {
    let s = createDamesState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
    });
    s = __test_clearBoard(s);
    // Dark man at (5,2) can jump light at (4,3) to (3,4)
    s = __test_place(s, idx(5, 2), { side: 'dark', king: false });
    s = __test_place(s, idx(4, 3), { side: 'light', king: false });
    s.currentSide = 'dark';
    const legal = getLegalDamesActions(s, 'a');
    assert.ok(legal.every((m) => m.from === idx(5, 2) && m.to === idx(3, 4)));
    assert.equal(legal.length, 1);
  });

  it('captures and promotes', () => {
    let s = createDamesState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
    });
    s = __test_clearBoard(s);
    // Dark near promotion + a light piece elsewhere so the game continues
    s = __test_place(s, idx(1, 2), { side: 'dark', king: false });
    s = __test_place(s, idx(2, 1), { side: 'light', king: false });
    s.currentSide = 'dark';
    const { state } = applyDamesAction(s, { type: 'move', from: idx(1, 2), to: idx(0, 3) });
    assert.equal(state.board[idx(0, 3)]?.king, true);
    assert.equal(state.status, 'active');
    assert.equal(state.currentSide, 'light');
  });

  it('wins when opponent has no pieces', () => {
    let s = createDamesState({
      modeId: 'public-2',
      playerIds: ['a', 'b'],
    });
    s = __test_clearBoard(s);
    s = __test_place(s, idx(5, 2), { side: 'dark', king: false });
    s = __test_place(s, idx(4, 3), { side: 'light', king: false });
    s.currentSide = 'dark';
    const { state } = applyDamesAction(s, {
      type: 'move',
      from: idx(5, 2),
      to: idx(3, 4),
    });
    assert.equal(state.status, 'finished');
    assert.equal(state.winnerId, 'a');
  });
});
