import {
  ASError,
  AmbSheetDoc,
  BasicRawValue,
  Position,
  Range,
  RawValue,
} from './datatype';
import * as d3 from 'd3';
import {
  isFormula,
  parseFormula,
  parseLiteral,
  Node,
  AmbNode,
  AmbRangePart,
  RefNode,
} from './parse';
import { simpleNameForCell } from './print';

export interface Value {
  context: AmbContext;
  rawValue: RawValue;
}

type Continuation = (value: Value, pos: Position, context: AmbContext) => void;

// We fix a random seed so that random distributions return the same values across evals.
export const RANDOM_SEED = 0.5;

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

export type FilteredResultsForCell =
  | { value: Value; include: boolean }[]
  | typeof NOT_READY
  | null;
export type FilteredResults = FilteredResultsForCell[][];

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
  '+'([x, y]: RawValue[]) {
    return typeof x !== 'number' || typeof y !== 'number'
      ? new ASError('#VALUE!', '+ expects numeric operands')
      : x + y;
  },
  '-'([x, y]: RawValue[]) {
    return typeof x !== 'number' || typeof y !== 'number'
      ? new ASError('#VALUE!', '- expects numeric operands')
      : x - y;
  },
  '*'([x, y]: RawValue[]) {
    return typeof x !== 'number' || typeof y !== 'number'
      ? new ASError('#VALUE!', '* expects numeric operands')
      : x * y;
  },
  '/'([x, y]: RawValue[]) {
    return typeof x !== 'number' || typeof y !== 'number'
      ? new ASError('#VALUE!', '/ expects numeric operands')
      : y == 0
      ? new ASError('#DIV/0!', 'divide by zero')
      : x / y;
  },
  '='([x, y]: RawValue[]) {
    return x == y;
  },
  '<>'([x, y]: RawValue[]) {
    return x != y;
  },
  '>'([x, y]: RawValue[]) {
    return x > y;
  },
  '>='([x, y]: RawValue[]) {
    return x >= y;
  },
  '<'([x, y]: RawValue[]) {
    return x < y;
  },
  '<='([x, y]: RawValue[]) {
    return x <= y;
  },
  sum(xs: RawValue[]) {
    return xs.length === 0
      ? new ASError('#N/A', 'sum() expects at least one argument')
      : (flatten(xs) as number[]).reduce((x, y) => x + (y ?? 0), 0);
  },
  product(xs: RawValue[]) {
    return xs.length === 0
      ? new ASError('#N/A', 'product() expects at least one argument')
      : (flatten(xs) as number[]).reduce((x, y) => x * (y ?? 1), 1);
  },
  // TODO: add count
  // TODO: add avg
  min(xs: RawValue[]) {
    return xs.length === 0
      ? new ASError('#N/A', 'min() expects at least one argument')
      : Math.min(...(flatten(xs).filter(notNull) as number[]));
  },
  max(xs: RawValue[]) {
    return xs.length === 0
      ? new ASError('#N/A', 'max() expects at least one argument')
      : Math.max(...(flatten(xs).filter(notNull) as number[]));
  },
  and(xs: RawValue[]) {
    const args = flatten(xs);
    return !args.every((arg) => typeof arg === 'boolean')
      ? new ASError('#VALUE!', 'and() expects boolean arguments')
      : args.reduce((a, b) => a && b, true);
  },
  or(xs: RawValue[]) {
    const args = flatten(xs);
    return !args.every((arg) => typeof arg === 'boolean')
      ? new ASError('#VALUE!', 'or() expects boolean arguments')
      : args.reduce((a, b) => a || b, false);
  },
  not(xs: RawValue[]) {
    return xs.length !== 1 || typeof xs[0] !== 'boolean'
      ? new ASError('#VALUE!', 'not() expects a single boolean argument')
      : !xs[0];
  },
  concat(xs: RawValue[]) {
    return flatten(xs).join('');
  },
  vlookup([key, range, index, _isOrdered]: [RawValue, Range, number, boolean]) {
    // TODO: if isOrdered, do binary search
    const col = index - 1;
    if (0 <= col && col < range[0].length) {
      for (const row of range) {
        if (key === row[0]) {
          return row[col];
        }
      }
    }
    return new ASError('#N/A', 'key not found');
  },
  // TODO: hlookup
};

function notNull<T>(x: T | null): x is T {
  return x != null;
}

function flatten(args: RawValue[]): BasicRawValue[] {
  const values: BasicRawValue[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const vs of arg) {
        values.push(...vs);
      }
    } else {
      values.push(arg as BasicRawValue);
    }
  }
  return values;
}

function isError(rawValue: RawValue): rawValue is ASError {
  return rawValue instanceof ASError;
}

/**
 * An evaluation environment tracking results of evaluated cells
 * during the course of an evaluation pass.
 */
export class Env {
  // accumulate evaluation results at each point in the sheet
  public results: Results;

  constructor(private data: AmbSheetDoc['data']) {
    this.results = data.map((cells, row) =>
      cells.map((cell, col) => {
        if (cell === '' || cell === null) {
          return null;
        } else if (isFormula(cell)) {
          return NOT_READY;
        } else {
          return [
            {
              rawValue: parseLiteral(cell, { row, col }),
              context: new Map(),
            },
          ];
        }
      })
    );
  }

  getCellValues({ row, col }: Position): Value[] | null | typeof NOT_READY {
    return 0 <= row &&
      row < this.results.length &&
      0 <= col &&
      col < this.results[row].length
      ? this.results[row][col]
      : null;
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
        const cellPos = toCellPosition(node, pos);
        const values = this.getCellValues(cellPos);
        if (!isReady(values)) {
          throw NOT_READY;
        } else if (values == null) {
          continuation(
            {
              context,
              rawValue: null, // new ASError('#REF!', 'invalid cell reference'),
            },
            pos,
            context
          );
        } else {
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
        }
        return;
      }
      case 'range': {
        const topLeft = toCellPosition(node.topLeft, pos);
        const bottomRight = toCellPosition(node.bottomRight, pos);
        return topLeft.col > bottomRight.col || topLeft.row > bottomRight.row
          ? continuation(
              { context, rawValue: new ASError('#REF!', 'invalid range') },
              pos,
              context
            )
          : this.collectRange(topLeft, bottomRight, pos, context, continuation);
      }
      case 'if':
        return this.interp(
          node.cond,
          pos,
          context,
          (cond, pos, contextAfterCond) =>
            this.interp(
              cond.rawValue ? node.then : node.else,
              pos,
              contextAfterCond,
              continuation
            )
        );
      case 'call': {
        const fn = builtInFunctions[node.funcName];
        return fn == null
          ? new ASError(
              '#NAME?',
              'unsupported built-in function: ' + node.funcName
            )
          : this.reduce(node.args, fn, [], pos, context, continuation);
      }
      case 'amb': {
        // call the continuation for each value in the amb node,
        // tracking which value we've chosen in the context.
        let i = 0;
        for (const part of node.parts) {
          switch (part.type) {
            case 'repeat': {
              for (let idx = 0; idx < part.numRepeats; idx++) {
                const newContext = new Map([...context, [node, i++]]);
                continuation(
                  { context: newContext, rawValue: part.value },
                  pos,
                  newContext
                );
              }
              break;
            }
            case 'range': {
              if (isSensibleRange(part)) {
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
              break;
            }
          }
        }
        return;
      }
      case 'ambify':
        return this.interp(node.range, pos, context, (value, pos, context) => {
          if (!Array.isArray(value.rawValue)) {
            throw new Error(
              'huh? this was supposed to be a BasicRawValue[][]!'
            );
          }

          for (const row of value.rawValue) {
            for (const value of row) {
              continuation({ context, rawValue: value }, pos, context);
            }
          }
        });
      case 'deambify':
        throw new Error('TODO: implement deambify');
      case 'normal': {
        // TODO: try/catch, turn exceptions into ASErrors
        const normalGenerator = d3.randomNormal.source(
          d3.randomLcg(RANDOM_SEED)
        )(node.mean, node.stdev);
        const values = Array.from({ length: node.samples }, normalGenerator);
        let i = 0;
        for (const value of values) {
          const newContext = new Map([...context, [node, i++]]);
          continuation(
            { context: newContext, rawValue: value },
            pos,
            newContext
          );
        }
        return;
      }
      default: {
        const exhaustiveCheck: never = node;
        throw new Error(`Unhandled node type: ${exhaustiveCheck}`);
      }
    }
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
      : this.interp(nodes[0], pos, context, (value, pos, context) => {
          if (isError(value.rawValue)) {
            continuation(value, pos, context);
          } else {
            this.reduce(
              nodes.slice(1),
              fn,
              [...acc, value.rawValue],
              pos,
              context,
              continuation
            );
          }
        });
  }

  collectRange(
    topLeft: Position,
    bottomRight: Position,
    pos: Position,
    context: AmbContext,
    continuation: Continuation
  ) {
    const expandedRefs: RefNode[] = [];
    for (let row = topLeft.row; row <= bottomRight.row; row++) {
      for (let col = topLeft.col; col <= bottomRight.col; col++) {
        expandedRefs.push({
          type: 'ref',
          row,
          col,
          rowMode: 'absolute',
          colMode: 'absolute',
        });
      }
    }
    if (expandedRefs.length === 0) {
      return;
    }

    const numCols = bottomRight.col - topLeft.col + 1;
    return this.reduce(
      expandedRefs,
      (xs: BasicRawValue[]) => {
        const rows: BasicRawValue[][] = [];
        while (xs.length > 0) {
          rows.push(xs.splice(0, numCols));
        }
        return rows;
      },
      [],
      pos,
      context,
      continuation
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
    const node = parseFormula(formula, pos);
    return this.evalNode(node, pos);
  }

  eval(): Env {
    while (true) {
      let didSomething = false;
      for (let row = 0; row < this.data.length; row++) {
        for (let col = 0; col < this.data[row].length; col++) {
          const pos = { row, col };
          const cell = this.data[row][col];
          if (this.getCellValues(pos) === NOT_READY) {
            try {
              const result = this.evalFormula(cell, pos);
              this.setCellValues(col, row, result);
              didSomething = true;
            } catch (error) {
              if (error === NOT_READY) {
                // if NOT_READY, just continue to the next cell
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

function isSensibleRange(part: AmbRangePart) {
  return (
    (part.from <= part.to && part.step > 0) ||
    (part.from >= part.to && part.step < 0)
  );
}

function toCellPosition(node: RefNode, pos: Position): Position {
  return {
    row: node.row + (node.rowMode === 'relative' ? pos.row : 0),
    col: node.col + (node.colMode === 'relative' ? pos.col : 0),
  };
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
        return (
          '{' + cell.map((v) => JSON.stringify(v.rawValue)).join(',') + '}'
        );
      }
    })
  );
}

export const resolvePositionsInContext = (
  context: AmbContext
): AmbContextWithResolvedPositions =>
  Object.fromEntries(
    Array.from(context.entries()).map(([key, val]) => [
      simpleNameForCell(key.pos),
      val,
    ])
  );

export const evalSheet = (data: AmbSheetDoc['data']) => new Env(data).eval();
