import { AmbSheetDoc } from './datatype';
import { isFormula, parseFormula, Node } from './parse';

export interface Value {
  rawValue: number;
  node: Node;
  childValues: Value[];
}

type Cont = (value: Value) => void;

const NOT_READY = {};

const isReady = (
  cellValues: Value[] | typeof NOT_READY
): cellValues is Value[] => cellValues !== NOT_READY;

/**
 * An evaluation environment tracking results of evaluated cells
 * during the course of an evaluation pass.
 */
export class Env {
  // accumulate evaluation results at each point in the sheet
  public results: (Value[] | typeof NOT_READY | null)[][];

  constructor(private data: AmbSheetDoc['data']) {
    this.results = data.map((row) =>
      row.map((cell) => {
        if (cell === '' || cell === null) {
          return null;
        } else if (isFormula(cell)) {
          return NOT_READY;
        } else {
          const value = parseFloat(cell);
          return [
            {
              rawValue: value,
              node: { type: 'num', value },
              childValues: [],
            },
          ];
        }
      })
    );
  }

  getCellValues({
    row,
    col,
  }: {
    row: number;
    col: number;
  }): Value[] | typeof NOT_READY {
    // console.log({ results: this.results, row, col });
    return this.results[row][col];
  }

  setCellValues(col: number, row: number, values: Value[]) {
    this.results[row][col] = values;
  }

  interp(node: Node, cont: Cont) {
    switch (node.type) {
      case 'num':
        return cont({
          rawValue: node.value,
          node,
          childValues: [],
        });
      case 'ref': {
        const values = this.getCellValues(node);
        if (!isReady(values)) {
          throw NOT_READY;
        }
        for (const value of values) {
          cont(value);
        }
        return;
      }
      case '=':
        return this.interpBinOp(node, cont, (a, b) => (a == b ? 1 : 0));
      case '>':
        return this.interpBinOp(node, cont, (a, b) => (a > b ? 1 : 0));
      case '>=':
        return this.interpBinOp(node, cont, (a, b) => (a >= b ? 1 : 0));
      case '<':
        return this.interpBinOp(node, cont, (a, b) => (a < b ? 1 : 0));
      case '<=':
        return this.interpBinOp(node, cont, (a, b) => (a <= b ? 1 : 0));
      case '+':
        return this.interpBinOp(node, cont, (a, b) => a + b);
      case '*':
        return this.interpBinOp(node, cont, (a, b) => a * b);
      case '-':
        return this.interpBinOp(node, cont, (a, b) => a - b);
      case '/':
        return this.interpBinOp(node, cont, (a, b) => a / b);
      case 'if':
        return this.interp(node.cond, (cond) =>
          this.interp(cond.rawValue !== 0 ? node.then : node.else, cont)
        );
      case 'amb':
        // call the continuation for each value in the amb node
        for (const expr of node.values) {
          this.interp(expr, cont);
        }
        return;
      default: {
        const exhaustiveCheck: never = node;
        throw new Error(`Unhandled node type: ${exhaustiveCheck}`);
      }
    }
  }

  interpBinOp(
    node: Node & { left: Node; right: Node },
    cont: Cont,
    op: (x: number, y: number) => number
  ) {
    this.interp(node.left, (left) =>
      this.interp(node.right, (right) =>
        cont({
          rawValue: op(left.rawValue, right.rawValue),
          node,
          childValues: [left, right],
        })
      )
    );
  }

  // The outermost continuation just collects up all results from the sub-paths of execution
  evalNode(node: Node) {
    const results: Value[] = [];
    this.interp(node, (value) => results.push(value));
    return results;
  }

  evalFormula(formula: string) {
    const node = parseFormula(formula);
    return this.evalNode(node);
  }

  print() {
    return this.results.map((row) =>
      row.map((cell) => {
        if (!isReady(cell)) {
          throw new Error("can't print an env with NOT_READY cells");
        } else if (cell === null) {
          return '';
        } else if (cell.length === 1) {
          return '' + cell[0].rawValue;
        } else {
          return '{' + cell.map((v) => v.rawValue).join(',') + '}';
        }
      })
    );
  }
}

export const evaluateSheet = (data: AmbSheetDoc['data']): Env => {
  const env = new Env(data);
  while (true) {
    let didSomething = false;
    for (let row = 0; row < data.length; row++) {
      for (let col = 0; col < data[row].length; col++) {
        const cell = data[row][col];
        if (env.getCellValues({ row, col }) === NOT_READY && isFormula(cell)) {
          try {
            const result = env.evalFormula(cell.slice(1));
            env.setCellValues(col, row, result);
            didSomething = true;
          } catch (error) {
            if (error === NOT_READY) {
              // if NOT_READY, just continue to the next cell
              console.log('not ready, skip');
            } else {
              throw error; // rethrow unexpected errors
            }
          }
        }
      }
    }
    if (!didSomething) {
      break;
    }
  }

  return env;
};
