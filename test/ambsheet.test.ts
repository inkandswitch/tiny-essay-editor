import assert from "assert";
import { describe, it } from "vitest";
import { Env, evaluateFormula } from "@/ambsheet/eval.js";

const getFormulaResult = (formula: string) => {
  const env = new Env([[]]);
  const result = evaluateFormula(env, formula);
  if (result.length === 1) {
    return result[0].raw;
  } else {
    return result.map((r) => r.raw);
  }
};

describe("ambsheet evaluator", () => {
  it("handles basic addition", () => {
    assert.deepEqual(getFormulaResult("1 + 1"), 2);
  });

  it("handles paren expressions", () => {
    assert.deepEqual(getFormulaResult("(2 + 2) * 3"), 12);
  });

  it("handles one amb", () => {
    assert.deepEqual(getFormulaResult("{1, 2, 3} * 5"), [5, 10, 15]);
  });

  it("handles two ambs", () => {
    assert.deepEqual(getFormulaResult("{2, 3} * {5, 6}"), [10, 12, 15, 18]);
  });

  it("handles empty amb", () => {
    assert.deepEqual(getFormulaResult("2 * {}"), []);
  });
});
