import { AmbSheetDoc } from './datatype';
import * as ohm from 'ohm-js';

type Node =
  | { type: 'num'; value: number }
  | { type: 'amb'; values: Node[] }
  | { type: 'ref'; row: number; col: number }
  | { type: '='; left: Node; right: Node }
  | { type: '>'; left: Node; right: Node }
  | { type: '>='; left: Node; right: Node }
  | { type: '<'; left: Node; right: Node }
  | { type: '<='; left: Node; right: Node }
  | { type: '+'; left: Node; right: Node }
  | { type: '-'; left: Node; right: Node }
  | { type: '*'; left: Node; right: Node }
  | { type: '/'; left: Node; right: Node }
  | { type: 'if'; cond: Node; then: Node; else: Node };

interface Value {
  raw: number;
  node: Node;
  operands: Value[];
}

const grammarSource = String.raw`
  AmbSheets {
    Exp = RelExp
  
    RelExp
      = AddExp "="  AddExp  -- eq
      | AddExp ">=" AddExp  -- ge
      | AddExp ">"  AddExp  -- gt
      | AddExp "<=" AddExp  -- le
      | AddExp "<"  AddExp  -- lt
      | AddExp

    AddExp
      = AddExp "+" MulExp  -- plus
      | AddExp "-" MulExp  -- minus
      | MulExp

    MulExp
      = MulExp "*" CallExp  -- times
      | MulExp "/" CallExp  -- div
      | CallExp

    CallExp
      = "if" "(" Exp "," Exp "," Exp ")"  -- if
      | UnExp

    UnExp
      = "-" PriExp  -- neg
      | PriExp

    PriExp
      = number                   -- number
      | "{" ListOf<Exp, ","> "}" -- amb
      | "(" Exp ")"              -- paren
      | upper digit+             -- cellRef

    number = digit+
  }
`;

const g = ohm.grammar(grammarSource);

// console.log("match", g.match("1 + {2, 3}").succeeded());
// console.log("match", g.match("-1 + {2, 3}").succeeded());
// console.log("match", g.match("1 + {2, (3 + 4)}").succeeded());

const semantics = g.createSemantics().addOperation('toAst', {
  RelExp_eq(left, _op, right) {
    return {
      type: '=',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  RelExp_ge(left, _op, right) {
    return {
      type: '>=',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  RelExp_gt(left, _op, right) {
    return {
      type: '>',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  RelExp_le(left, _op, right) {
    return {
      type: '<=',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  RelExp_lt(left, _op, right) {
    return {
      type: '<',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  AddExp_plus(left, _op, right) {
    return {
      type: '+',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  AddExp_minus(left, _op, right) {
    return {
      type: '-',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  MulExp_times(left, _op, right) {
    return {
      type: '*',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  MulExp_div(left, _op, right) {
    return {
      type: '/',
      left: left.toAst(),
      right: right.toAst(),
    };
  },
  CallExp_if(_if, _lparen, cond, _c1, thenExp, _c2, elseExp, _rparen) {
    return {
      type: 'if',
      cond: cond.toAst(),
      then: thenExp.toAst(),
      else: elseExp.toAst(),
    };
  },
  UnExp_neg(_op, exp) {
    return {
      type: '-',
      left: { type: 'num', value: 0 },
      right: exp.toAst(),
    };
  },
  PriExp_number(number) {
    return {
      type: 'num',
      value: parseFloat(number.sourceString),
    };
  },
  PriExp_amb(_lbrace, list, _rbrace) {
    return {
      type: 'amb',
      values: list.toAst(),
    };
  },
  PriExp_paren(_lparen, exp, _rparen) {
    return exp.toAst();
  },
  PriExp_cellRef(col, row) {
    return {
      type: 'ref',
      col: col.sourceString.charCodeAt(0) - 'A'.charCodeAt(0),
      row: parseInt(row.sourceString) - 1,
    };
  },
  NonemptyListOf(x, _sep, xs) {
    return [x.toAst()].concat(xs.toAst());
  },
  EmptyListOf() {
    return [];
  },
  _iter(...children) {
    return children.map((c) => c.toAst());
  },
});

type Cont = (env: Env, value: Value) => void;

function interpretBinaryOp(
  env: Env,
  node: Node & { left: Node; right: Node },
  cont: Cont,
  op: (x: number, y: number) => number
) {
  interpret(env, node.left, (env, val1: Value) =>
    interpret(env, node.right, (env, val2: Value) =>
      cont(env, {
        raw: op(val1.raw, val2.raw),
        node: node,
        operands: [val1, val2],
      })
    )
  );
}

const NOT_READY = {};

function interpret(env: Env, node: Node, cont: Cont) {
  switch (node.type) {
    case 'num':
      cont(env, {
        raw: node.value,
        node,
        operands: [],
      });
      break;
    case 'ref': {
      const values = env.getValuesOfCell(node);
      if (!isReady(values)) {
        throw NOT_READY;
      }
      for (const value of values) {
        cont(env, value);
      }
      break;
    }
    case '=':
      interpretBinaryOp(env, node, cont, (a, b) => (a == b ? 1 : 0));
      break;
    case '>':
      interpretBinaryOp(env, node, cont, (a, b) => (a > b ? 1 : 0));
      break;
    case '>=':
      interpretBinaryOp(env, node, cont, (a, b) => (a >= b ? 1 : 0));
      break;
    case '<':
      interpretBinaryOp(env, node, cont, (a, b) => (a < b ? 1 : 0));
      break;
    case '<=':
      interpretBinaryOp(env, node, cont, (a, b) => (a <= b ? 1 : 0));
      break;
    case '+':
      interpretBinaryOp(env, node, cont, (a, b) => a + b);
      break;
    case '*':
      interpretBinaryOp(env, node, cont, (a, b) => a * b);
      break;
    case '-':
      interpretBinaryOp(env, node, cont, (a, b) => a - b);
      break;
    case '/':
      interpretBinaryOp(env, node, cont, (a, b) => a / b);
      break;
    case 'if':
      interpret(env, node.cond, (env, cond) =>
        interpret(env, cond.raw !== 0 ? node.then : node.else, cont)
      );
      break;
    // Run the continuation for each value in the AmbNode.
    case 'amb':
      for (const expr of node.values) {
        interpret(env, expr, cont);
      }
      break;
    default: {
      const exhaustiveCheck: never = node;
      throw new Error(`Unhandled node type: ${exhaustiveCheck}`);
    }
  }
}

// The outermost continuation just collects up all results
// from the sub-paths of execution
function evaluateAST(env: Env, ast: Node): Value[] {
  const results: Value[] = [];
  interpret(env, ast, (_env, value: Value) => {
    results.push(value);
  });
  return results;
}

export const isFormula = (cell: string) => cell && cell[0] === '=';

// An evaluation environment tracking results of evaluated cells
// during the course of an evaluation pass.
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
          return [
            {
              raw: parseFloat(cell),
              node: { type: 'num', value: parseFloat(cell) },
              operands: [],
            },
          ];
        }
      })
    );
  }
  getValuesOfCell({
    row,
    col,
  }: {
    row: number;
    col: number;
  }): Value[] | typeof NOT_READY {
    console.log({ results: this.results, row, col });
    return this.results[row][col];
  }

  setValuesOfCell(col: number, row: number, values: Value[]) {
    this.results[row][col] = values;
  }
}

const isReady = (cell: Value[] | typeof NOT_READY): cell is Value[] =>
  cell !== NOT_READY;

export const evaluateSheet = (data: AmbSheetDoc['data']): Env => {
  const env = new Env(data);
  while (true) {
    let didSomething = false;
    for (let row = 0; row < data.length; row++) {
      for (let col = 0; col < data[row].length; col++) {
        const cell = data[row][col];
        if (
          env.getValuesOfCell({ row, col }) === NOT_READY &&
          isFormula(cell)
        ) {
          try {
            const result = evaluateFormula(env, cell.slice(1));
            env.setValuesOfCell(col, row, result);
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

export const printEnv = (env: Env) => {
  return env.results.map((row) =>
    row.map((cell) => {
      if (!isReady(cell)) {
        throw new Error("can't print an env with NOT_READY cells");
      }

      if (cell === null) {
        return '';
      }

      if (cell.length === 1) {
        return '' + cell[0].raw;
      }
      return '{' + cell.map((v) => v.raw).join(',') + '}';
    })
  );
};

export const evaluateFormula = (env: Env, formula: string) => {
  const match = g.match(formula);
  const ast = semantics(match).toAst();
  const result = evaluateAST(env, ast);
  return result;
};
