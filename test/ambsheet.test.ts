import assert from 'assert';
import { describe, it } from 'vitest';
import { evalSheet } from '@/ambsheet/eval.js';

describe('ambsheet evaluator', () => {
  it('handles basic addition', () => {
    assert.deepStrictEqual(evalSheet([['=1 + 1']]).print(), [['2']]);
  });

  it('handles paren expressions', () => {
    assert.deepStrictEqual(evalSheet([['=(2 + 2) * 3']]).print(), [['12']]);
  });

  it('handles one amb', () => {
    assert.deepStrictEqual(evalSheet([['={1, 2, 3} * 5']]).print(), [
      ['{5,10,15}'],
    ]);
  });

  it('handles two ambs', () => {
    assert.deepStrictEqual(evalSheet([['={2, 3} * {5, 6}']]).print(), [
      ['{10,12,15,18}'],
    ]);
  });

  it('handles empty amb', () => {
    assert.deepStrictEqual(evalSheet([['=2 * {}']]).print(), [['{}']]);
  });

  it('can do a cell ref', () => {
    assert.deepStrictEqual(evalSheet([['5', '=A1+1']]).print(), [['5', '6']]);
  });

  it('can do a cell ref where deps are not in order of naive eval', () => {
    assert.deepStrictEqual(evalSheet([['5', '=C1+1', '=A1+2']]).print(), [
      ['5', '8', '7'],
    ]);
  });

  it('can do multiple cell refs', () => {
    assert.deepStrictEqual(
      evalSheet([['5', '=A1+1', '=B1*2'], ['=A1+B1+C1']]).print(),
      [['5', '6', '12'], ['23']]
    );
  });

  it('can do simple if, v1', () => {
    assert.deepStrictEqual(
      evalSheet([['={1,2,3}', '=if(A1>1, 111, {})']]).print(),
      [['{1,2,3}', '{111,111}']]
    );
  });

  it('can do simple if, v2', () => {
    assert.deepStrictEqual(
      evalSheet([['={1,2,3}', '=if(A1>1, 111, 222)']]).print(),
      [['{1,2,3}', '{222,111,111}']]
    );
  });
});
