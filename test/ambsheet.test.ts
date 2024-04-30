import assert from 'assert';
import { describe, it } from 'vitest';
import {
  FilteredResults,
  NOT_READY,
  Results,
  Value,
  evalSheet,
  filter,
  printResults,
} from '@/ambsheet/eval.js';

describe('ambsheet evaluator', () => {
  it('handles basic addition', () => {
    assert.deepStrictEqual(evalSheet([['=1 + 1.5']]).print(), [['2.5']]);
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

  it('can do a cell ref where deps are in order of naive eval', () => {
    assert.deepStrictEqual(evalSheet([['5', '=A1+2', '=B1+1']]).print(), [
      ['5', '7', '8'],
    ]);
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
      evalSheet([['={1,2,3}', '=IF(A1>1, 111, 222)']]).print(),
      [['{1,2,3}', '{222,111,111}']]
    );
  });

  it('reuses the same choice for a given amb within a cell', () => {
    assert.deepStrictEqual(evalSheet([['={1, 2, 3}', '=A1 * A1']]).print(), [
      ['{1,2,3}', '{1,4,9}'],
    ]);
  });

  it('reuses the same choice for a given amb across cell boundaries', () => {
    // All the results are only 1-dimensional (with 3 values) because there's
    // only 1 amb literal in the entire sheet.
    assert.deepStrictEqual(
      evalSheet([['={1, 2, 3}', '=A1 * A1', '=B1 + A1']]).print(),
      [['{1,2,3}', '{1,4,9}', '{2,6,12}']]
    );
  });

  it('does not reuse the amb choice given a fresh amb', () => {
    assert.deepStrictEqual(
      evalSheet([['={1, 2, 3}', '=A1 * A1', '=B1 + {1, 2, 3}']]).print(),
      [['{1,2,3}', '{1,4,9}', '{2,3,4,5,6,7,10,11,12}']]
    );
  });

  it('reuses amb choices across cell refs', () => {
    assert.deepStrictEqual(
      evalSheet([['={1, 2}', '={5, 6}', '=A1+1', '=B1+1', '=C1+D1']]).print(),
      [['{1,2}', '{5,6}', '{2,3}', '{6,7}', '{8,9,9,10}']]
    );
  });

  it('handles a case where RHS of a binop contains both an existing amb choice and a fresh amb', () => {
    assert.deepStrictEqual(
      // There are two amb literals in this spreadsheet, each with two values --
      // so we end up with 4 values (2x2) in the final result.
      // Notably, in cell B1, we reuse amb choices for A1, but we create fresh
      // amb choices for the new amb literal.
      evalSheet([['={1, 2}', '=A1*(A1+{3, 4})']]).print(),
      [['{1,2}', '{4,5,10,12}']]
    );
  });

  it('reuses amb choices from conditionals', () => {
    assert.deepStrictEqual(
      evalSheet([['={1, 2}', '=if(A1>1, A1, 5)']]).print(),
      [['{1,2}', '{5,2}']]
    );
  });

  const filteredResultsToResults = (
    filteredResults: FilteredResults
  ): Results => {
    return filteredResults.map((row) =>
      row.map((cell) => {
        if (cell === null || cell === NOT_READY) {
          return cell;
        }
        return (cell as { value: Value; include: boolean }[])
          .filter((v) => v.include)
          .map((v) => v.value);
      })
    );
  };

  it('filters values correctly', () => {
    const results = evalSheet([
      ['={1, 2}', '={3, 4}', '=A1*10+B1', '=C1>20'],
    ]).results;

    assert.deepStrictEqual(printResults(results), [
      ['{1,2}', '{3,4}', '{13,14,23,24}', '{0,0,1,1}'],
    ]);

    const cellC1 = results[0][2]; // C1
    const cellD1 = results[0][3]; // D1

    assert.deepStrictEqual(
      printResults(
        filteredResultsToResults(
          filter(results, [
            // select 14, 23 in the result cell
            [cellC1[1].context, cellC1[2].context],
          ])
        )
      ),
      [['{1,2}', '{3,4}', '{14,23}', '{0,1}']]
    );

    assert.deepStrictEqual(
      printResults(
        filteredResultsToResults(
          filter(results, [
            // select 13, 14 in the result cell
            [cellC1[0].context, cellC1[1].context],
          ])
        )
      ),
      [['1', '{3,4}', '{13,14}', '{0,0}']]
    );

    assert.deepStrictEqual(
      printResults(
        filteredResultsToResults(
          filter(results, [
            // select D1=1 in the result cell
            (cellD1 as Value[])
              .filter((v) => v.rawValue === 1)
              .map((v) => v.context),
          ])
        )
      ),
      [['2', '{3,4}', '{23,24}', '{1,1}']]
    );
  });

  it('evaluates references correctly', () => {
    // TODO: we need a better way to test absolute references
    assert.deepStrictEqual(
      evalSheet([['5', '=A1', '=$A$1', '=A$1', '=$A1']]).print(),
      [['5', '5', '5', '5', '5']]
    );
  });

  it('evaluates min and max correctly', () => {
    assert.deepStrictEqual(
      evalSheet([['5', '=A1+5', '=min(A1, B1)', '=max(A1, B1)']]).print(),
      [['5', '10', '5', '10']]
    );

    assert.deepStrictEqual(
      evalSheet([
        ['5', '=A1+5', '={-7,0,17}', '=min(A1, B1, C1)', '=max(A1, B1, C1)'],
      ]).print(),
      [['5', '10', '{-7,0,17}', '{-7,0,5}', '{10,10,17}']]
    );

    assert.deepStrictEqual(
      evalSheet([['={-7,0,17}', '=min(a1, a1-1)']]).print(),
      [['{-7,0,17}', '{-8,-1,16}']]
    );
  });

  it('supports repetition and ranges in amb literals', () => {
    assert.deepStrictEqual(evalSheet([['={9x4}', '=a1+3']]).print(), [
      ['{9,9,9,9}', '{12,12,12,12}'],
    ]);
    assert.deepStrictEqual(evalSheet([['={1,9x4,3}', '=a1+3']]).print(), [
      ['{1,9,9,9,9,3}', '{4,12,12,12,12,6}'],
    ]);
    assert.deepStrictEqual(evalSheet([['={1 to 3}', '=a1*2']]).print(), [
      ['{1,2,3}', '{2,4,6}'],
    ]);
    assert.deepStrictEqual(
      evalSheet([['={0x3, 1 to 10 by 2, -2x3, -8 to 2 by 3}']]).print(),
      [['{0,0,0,1,3,5,7,9,-2,-2,-2,-8,-5,-2,1}']]
    );
    assert.deepStrictEqual(evalSheet([['={10 to 0}']]).print(), [
      ['{10,9,8,7,6,5,4,3,2,1,0}'],
    ]);
  });
});
