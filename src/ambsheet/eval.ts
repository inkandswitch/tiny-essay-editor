import { AmbSheetDoc } from './datatype';
import { isFormula, parseFormula, Node, AmbNode } from './parse';

export interface Value {
  context: AmbContext;
  rawValue: number;
}

type Cont = (value: Value, context: AmbContext) => void;

/** a mapping that tracks which value we've chosen for a given amb node
 *  within the current subtree of the evaluation. (using a numeric index
 *  into the list of values, so that we can disambiguate equivalent values)
 */
type AmbContext = Map<AmbNode, number>;

// Two contexts are "compatible" if they contain no overlapping keys with differing values
const contextsAreCompatible = (a: AmbContext, b: AmbContext) => {
  for (const [node, value] of a) {
    if (b.has(node) && b.get(node) !== value) {
      return false;
    }
  }
  return true;
};

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
              context: new Map(),
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

  interp(node: Node, context: AmbContext, cont: Cont) {
    switch (node.type) {
      case 'num':
        return cont(
          {
            rawValue: node.value,
            context,
          },
          context
        );
      case 'ref': {
        const values = this.getCellValues(node);
        if (!isReady(values)) {
          throw NOT_READY;
        }
        for (const value of values) {
          // This is important: if the current execution context is not compatible
          // with this value we're trying to iterate over, we skip executing it.
          // This ensures that we respect any previous amb choices from this execution.
          if (!contextsAreCompatible(context, value.context)) {
            continue;
          }
          const newContext = new Map([...context, ...value.context]);
          cont(value, newContext);
        }
        return;
      }
      case '=':
        return this.interpBinOp(node, context, cont, (a, b) =>
          a == b ? 1 : 0
        );
      case '>':
        return this.interpBinOp(node, context, cont, (a, b) => (a > b ? 1 : 0));
      case '>=':
        return this.interpBinOp(node, context, cont, (a, b) =>
          a >= b ? 1 : 0
        );
      case '<':
        return this.interpBinOp(node, context, cont, (a, b) => (a < b ? 1 : 0));
      case '<=':
        return this.interpBinOp(node, context, cont, (a, b) =>
          a <= b ? 1 : 0
        );
      case '+':
        return this.interpBinOp(node, context, cont, (a, b) => a + b);
      case '*':
        return this.interpBinOp(node, context, cont, (a, b) => a * b);
      case '-':
        return this.interpBinOp(node, context, cont, (a, b) => a - b);
      case '/':
        return this.interpBinOp(node, context, cont, (a, b) => a / b);
      case 'if':
        return this.interp(node.cond, context, (cond, contextAfterCond) =>
          this.interp(
            cond.rawValue !== 0 ? node.then : node.else,
            contextAfterCond,
            cont
          )
        );
      case 'amb':
        // call the continuation for each value in the amb node,
        // tracking which value we've chosen in the context.
        for (const [i, expr] of node.values.entries()) {
          const newContext = new Map([...context, [node, i]]);
          this.interp(expr, newContext, cont);
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
    context: AmbContext,
    cont: Cont,
    op: (x: number, y: number) => number
  ) {
    this.interp(node.left, context, (left, contextAfterLeft) =>
      // Any amb choices made by the left side are used to constrain the right side
      this.interp(node.right, contextAfterLeft, (right, contextAfterRight) =>
        cont(
          {
            rawValue: op(left.rawValue, right.rawValue),
            context: contextAfterRight,
          },
          contextAfterRight
        )
      )
    );
  }

  // The outermost continuation just collects up all results from the sub-paths of execution
  evalNode(node: Node) {
    const results: Value[] = [];
    const context = new Map(); // init an empty amb context -- we haven't made any choices yet
    this.interp(node, context, (value, _context) => results.push(value));
    return results;
  }

  evalFormula(formula: string) {
    const node = parseFormula(formula);
    return this.evalNode(node);
  }

  eval(): Env {
    while (true) {
      let didSomething = false;
      for (let row = 0; row < this.data.length; row++) {
        for (let col = 0; col < this.data[row].length; col++) {
          const cell = this.data[row][col];
          if (
            this.getCellValues({ row, col }) === NOT_READY &&
            isFormula(cell)
          ) {
            try {
              const result = this.evalFormula(cell);
              this.setCellValues(col, row, result);
              didSomething = true;
            } catch (error) {
              if (error === NOT_READY) {
                // if NOT_READY, just continue to the next cell
                // console.log('not ready, skip');
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

    return this;
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

export const evalSheet = (data: AmbSheetDoc['data']) => new Env(data).eval();
