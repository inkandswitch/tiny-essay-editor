import { AmbSheetDoc, Position, RawValue } from './datatype';
import {
  isFormula,
  parseFormula,
  Node,
  AmbNode,
  cellIndexToName,
} from './parse';

export interface Value {
  context: AmbContext;
  rawValue: RawValue;
}

type Continuation = (value: Value, pos: Position, context: AmbContext) => void;

/**
 * A mapping that tracks which value we've chosen for a given amb node
 * within the current subtree of the evaluation. (using a numeric index
 * into the list of values, so that we can disambiguate equivalent values)
 */
export type AmbContext = Map<AmbNode, number>;

type CellName = string;

// An Amb context using cell names as keys instead of amb nodes
export type AmbContextWithResolvedPositions = {
  [key: CellName]: number;
};

// Two contexts are "compatible" if they contain no overlapping keys with differing values
export const contextsAreCompatible = (a: AmbContext, b: AmbContext) => {
  for (const [node, value] of a) {
    if (b.has(node) && b.get(node) !== value) {
      return false;
    }
  }
  return true;
};

export const contextsWithResolvedPositionsAreCompatible = (
  a: AmbContextWithResolvedPositions,
  b: AmbContextWithResolvedPositions
) => {
  for (const [cell, value] of Object.entries(a)) {
    if (b[cell] !== undefined && b[cell] !== value) {
      return false;
    }
  }
  return true;
};

export type Results = (Value[] | typeof NOT_READY | null)[][];

export type FilteredResults = (
  | { value: Value; include: boolean }[]
  | typeof NOT_READY
  | null
)[][];

// AND of ORs
export function filter(
  results: Results,
  contextses: AmbContext[][]
): FilteredResults {
  const shouldInclude = (v: Value) =>
    contextses.every((contexts) =>
      contexts.some((ctx) => contextsAreCompatible(ctx, v.context))
    );
  return results.map((row) =>
    row.map((cell) => {
      if (cell == null || cell === NOT_READY) {
        return cell;
      }

      // todo: get rid of this typecast by using a type guard
      return (cell as Value[]).map((value) => ({
        value,
        include: shouldInclude(value),
      }));
    })
  );
}

export const NOT_READY = {};

const isReady = (
  cellValues: Value[] | typeof NOT_READY
): cellValues is Value[] => cellValues !== NOT_READY;

const builtInFunctions = {
  min(xs: RawValue[]) {
    if (xs.length === 0) {
      throw new Error('min() requires at least one argument');
    } else {
      return Math.min(...xs);
    }
  },
  max(xs: RawValue[]) {
    if (xs.length === 0) {
      throw new Error('min() requires at least one argument');
    } else {
      return Math.max(...xs);
    }
  },
};

/**
 * An evaluation environment tracking results of evaluated cells
 * during the course of an evaluation pass.
 */
export class Env {
  // accumulate evaluation results at each point in the sheet
  public results: Results;

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

  getCellValues({ row, col }: Position): Value[] | typeof NOT_READY {
    // console.log({ results: this.results, row, col });
    return this.results[row][col];
  }

  setCellValues(col: number, row: number, values: Value[]) {
    this.results[row][col] = values;
  }

  interp(
    node: Node,
    pos: Position,
    context: AmbContext,
    continuation: Continuation
  ) {
    switch (node.type) {
      case 'const':
        return continuation(
          {
            rawValue: node.value,
            context,
          },
          pos,
          context
        );
      case 'ref': {
        const cellPos = {
          row: node.row + (node.rowMode === 'relative' ? pos.row : 0),
          col: node.col + (node.colMode === 'relative' ? pos.col : 0),
        };
        const values = this.getCellValues(cellPos);
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
          continuation(value, pos, newContext);
        }
        return;
      }
      case '=':
        return this.interpBinOp(node, pos, context, continuation, (a, b) =>
          a == b ? 1 : 0
        );
      case '>':
        return this.interpBinOp(node, pos, context, continuation, (a, b) =>
          a > b ? 1 : 0
        );
      case '>=':
        return this.interpBinOp(node, pos, context, continuation, (a, b) =>
          a >= b ? 1 : 0
        );
      case '<':
        return this.interpBinOp(node, pos, context, continuation, (a, b) =>
          a < b ? 1 : 0
        );
      case '<=':
        return this.interpBinOp(node, pos, context, continuation, (a, b) =>
          a <= b ? 1 : 0
        );
      case '+':
        return this.interpBinOp(
          node,
          pos,
          context,
          continuation,
          (a, b) => a + b
        );
      case '*':
        return this.interpBinOp(
          node,
          pos,
          context,
          continuation,
          (a, b) => a * b
        );
      case '-':
        return this.interpBinOp(
          node,
          pos,
          context,
          continuation,
          (a, b) => a - b
        );
      case '/':
        return this.interpBinOp(
          node,
          pos,
          context,
          continuation,
          (a, b) => a / b
        );
      case 'if':
        return this.interp(
          node.cond,
          pos,
          context,
          (cond, pos, contextAfterCond) =>
            this.interp(
              cond.rawValue !== 0 ? node.then : node.else,
              pos,
              contextAfterCond,
              continuation
            )
        );
      case 'call': {
        const fn = builtInFunctions[node.funcName];
        if (fn == null) {
          throw new Error('unsupported built-in function: ' + node.funcName);
        } else {
          return this.reduce(node.args, fn, [], pos, context, continuation);
        }
      }
      case 'amb': {
        // call the continuation for each value in the amb node,
        // tracking which value we've chosen in the context.
        let i = 0;
        for (const part of node.parts) {
          if (part.type === 'repeat') {
            for (let idx = 0; idx < part.numRepeats; idx++) {
              const newContext = new Map([...context, [node, i++]]);
              continuation(
                { context: newContext, rawValue: part.value },
                pos,
                newContext
              );
            }
          } else {
            let v = part.from;
            while (part.from < part.to ? v <= part.to : v >= part.to) {
              const newContext = new Map([...context, [node, i++]]);
              continuation(
                { context: newContext, rawValue: v },
                pos,
                newContext
              );
              v += part.step;
            }
          }
        }
        return;
      }
      default: {
        const exhaustiveCheck: never = node;
        throw new Error(`Unhandled node type: ${exhaustiveCheck}`);
      }
    }
  }

  interpBinOp(
    node: Node & { left: Node; right: Node },
    pos: Position,
    context: AmbContext,
    continuation: Continuation,
    op: (x: RawValue, y: RawValue) => RawValue
  ) {
    this.interp(node.left, pos, context, (left, pos, contextAfterLeft) =>
      // Any amb choices made by the left side are used to constrain the right side
      this.interp(
        node.right,
        pos,
        contextAfterLeft,
        (right, pos, contextAfterRight) =>
          continuation(
            {
              rawValue: op(left.rawValue, right.rawValue),
              context: contextAfterRight,
            },
            pos,
            contextAfterRight
          )
      )
    );
  }

  reduce(
    nodes: Node[],
    fn: (xs: RawValue[]) => RawValue,
    acc: RawValue[],
    pos: Position,
    context: AmbContext,
    continuation: Continuation
  ) {
    return nodes.length === 0
      ? continuation({ rawValue: fn(acc), context }, pos, context)
      : this.interp(nodes[0], pos, context, (value, pos, context) =>
          this.reduce(
            nodes.slice(1),
            fn,
            [...acc, value.rawValue],
            pos,
            context,
            continuation
          )
        );
  }

  // The outermost continuation just collects up all results from the sub-paths of execution
  evalNode(node: Node, pos: Position) {
    const results: Value[] = [];
    const context = new Map(); // init an empty amb context -- we haven't made any choices yet
    this.interp(node, pos, context, (value, _context) => results.push(value));
    return results;
  }

  evalFormula(formula: string, pos: Position) {
    // TODO: consider caching "nodes"
    // (parse eagerly and cache, whenever the formula changes)
    try {
      const node = parseFormula(formula, pos);
      return this.evalNode(node, pos);
    } catch (e) {
      console.error('eeep!', e);
      return [];
    }
  }

  eval(): Env {
    while (true) {
      let didSomething = false;
      for (let row = 0; row < this.data.length; row++) {
        for (let col = 0; col < this.data[row].length; col++) {
          const pos = { row, col };
          const cell = this.data[row][col];
          if (this.getCellValues(pos) === NOT_READY && isFormula(cell)) {
            try {
              const result = this.evalFormula(cell, pos);
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
    return printResults(this.results);
  }
}

export function printResults(results: Results) {
  return results.map((row) =>
    row.map((cell) => {
      if (!isReady(cell)) {
        return 'ERROR!';
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

export const resolvePositionsInContext = (
  context: AmbContext
): AmbContextWithResolvedPositions =>
  Object.fromEntries(
    Array.from(context.entries()).map(([key, val]) => [
      cellIndexToName(key.pos),
      val,
    ])
  );

export const evalSheet = (data: AmbSheetDoc['data']) => new Env(data).eval();
