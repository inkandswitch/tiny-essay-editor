import assert from 'assert';
import { describe, it } from 'vitest';
import {
  FilteredResults,
  NOT_READY,
  Results,
  Value,
  evalSheet,
  filter,
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

  it('filters values correctly', () => {
    const results = evalSheet([['={1, 2}', '={3, 4}', '=A1*10+B1']]).results;

    assert.deepStrictEqual(printResults(results), [
      ['{1,2}', '{3,4}', '{13,14,23,24}'],
    ]);

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

    const resultCell = results[0][2];

    assert.deepStrictEqual(
      printResults(
        filteredResultsToResults(
          filter(results, [
            // select 14, 23 in the result cell
            [resultCell[1].context, resultCell[2].context],
          ])
        )
      ),
      [['{1,2}', '{3,4}', '{14,23}']]
    );

    assert.deepStrictEqual(
      printResults(
        filteredResultsToResults(
          filter(results, [
            // select 13, 14 in the result cell
            [resultCell[0].context, resultCell[1].context],
          ])
        )
      ),
      [['1', '{3,4}', '{13,14}']]
    );
  });
});
