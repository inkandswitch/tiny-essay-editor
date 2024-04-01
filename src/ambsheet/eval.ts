import { AmbSheetDoc } from "./datatype";
import * as ohm from "ohm-js";

type Node =
  | { type: "NumberNode"; value: number }
  | { type: "AmbNode"; values: Node[] }
  | { type: "CellRefNode"; name: string }
  | { type: "PlusNode"; arg1: Node; arg2: Node }
  | { type: "MinusNode"; arg1: Node; arg2: Node }
  | { type: "TimesNode"; arg1: Node; arg2: Node }
  | { type: "DivideNode"; arg1: Node; arg2: Node };

interface Value {
  raw: number;
  node: Node;
  operands: Value[];
}

const grammarSource = String.raw`
  Arithmetic {
    Exp = AddExp

    AddExp = AddExp "+" MulExp  -- plus
          | AddExp "-" MulExp  -- minus
          | MulExp

    MulExp = MulExp "*" UnExp  -- times
          | MulExp "/" UnExp  -- div
          | UnExp

    UnExp = "-" PriExp -- neg
          | PriExp

    PriExp = number -- number
          | "{" ListOf<Exp, ","> "}" -- amb
          | "(" Exp ")" -- paren
          | letter+ digit+ -- cellRef

    number = digit+
  }
`;

const g = ohm.grammar(grammarSource);

// console.log("match", g.match("1 + {2, 3}").succeeded());
// console.log("match", g.match("-1 + {2, 3}").succeeded());
// console.log("match", g.match("1 + {2, (3 + 4)}").succeeded());

const semantics = g.createSemantics().addOperation("toAst", {
  AddExp_plus(left, _op, right) {
    return {
      type: "PlusNode",
      arg1: left.toAst(),
      arg2: right.toAst(),
    };
  },
  AddExp_minus(left, _op, right) {
    return {
      type: "MinusNode",
      arg1: left.toAst(),
      arg2: right.toAst(),
    };
  },
  MulExp_times(left, _op, right) {
    return {
      type: "TimesNode",
      arg1: left.toAst(),
      arg2: right.toAst(),
    };
  },
  MulExp_div(left, _op, right) {
    return {
      type: "DivideNode",
      arg1: left.toAst(),
      arg2: right.toAst(),
    };
  },
  UnExp_neg(_op, exp) {
    return {
      type: "MinusNode",
      arg1: { type: "NumberNode", value: 0 },
      arg2: exp.toAst(),
    };
  },
  PriExp_number(number) {
    return {
      type: "NumberNode",
      value: parseFloat(number.sourceString),
    };
  },
  PriExp_amb(_lbrace, list, _rbrace) {
    return {
      type: "AmbNode",
      values: list.toAst(),
    };
  },
  PriExp_paren(_lparen, exp, _rparen) {
    return exp.toAst();
  },
  PriExp_cellRef(_row, _col) {
    return {
      type: "CellRefNode",
      name: this.sourceString,
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
  node: Node & { arg1: Node; arg2: Node },
  cont: Cont,
  op: (x: number, y: number) => number
) {
  interpret(env, node.arg1, (env, val1: Value) =>
    interpret(env, node.arg2, (env, val2: Value) =>
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
    case "NumberNode":
      cont(env, {
        raw: node.value,
        node,
        operands: [],
      });
      break;
    case "CellRefNode": {
      const value = env.getValue(node.name);
      if (value === NOT_READY) {
        throw NOT_READY;
      }
      cont(env, value);
      break;
    }
    case "PlusNode":
      interpretBinaryOp(env, node, cont, (a, b) => a + b);
      break;
    case "TimesNode":
      interpretBinaryOp(env, node, cont, (a, b) => a * b);
      break;
    case "MinusNode":
      interpretBinaryOp(env, node, cont, (a, b) => a - b);
      break;
    case "DivideNode":
      interpretBinaryOp(env, node, cont, (a, b) => a / b);
      break;
    // Run the continuation for each value in the AmbNode.
    case "AmbNode":
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
function evaluateAST(env: Env, ast: Node) {
  const results = [];
  interpret(env, ast, (_env, value) => {
    results.push(value);
  });
  return results;
}

export const isFormula = (cell: string) => cell && cell[0] === "=";

// An evaluation environment tracking results of evaluated cells
// during the course of an evaluation pass.
export class Env {
  constructor(private data: AmbSheetDoc["data"]) {}

  getValue(_name: string): Value {
    // stub
    return {
      raw: 1,
      node: { type: "NumberNode", value: 1 },
      operands: [],
    };
  }
}

export const evaluateSheet = (data: AmbSheetDoc["data"]) => {
  const env = new Env(data);
  return data.map((row) => {
    return row.map((cell) => {
      if (isFormula(cell)) {
        const ast = semantics(g.match(cell.slice(1))).toAst();
        const result = evaluateAST(env, ast);
        if (result.length === 1) {
          return result[0].raw;
        } else {
          return "{" + result.map((r) => r.raw).join(",") + "}";
        }
      } else {
        return cell;
      }
    });
  });
};

export const evaluateFormula = (env: Env, formula: string) => {
  const match = g.match(formula);
  const ast = semantics(match).toAst();
  const result = evaluateAST(env, ast);
  return result;
};

// tests

// const p1_str = "{1, 3} * 5";
// const match = g.match(p1_str);
// const p1_ast = semantics(match).toAst();
// console.log("p1 ast", JSON.stringify(p1_ast, null, 2));
// console.log("Program 1:", JSON.stringify(evaluateAST(p1_ast), null, 2));

// const p2_str = "2 + {}";
// const match2 = g.match(p2_str);
// const p2_ast = semantics(match2).toAst();
// console.log("p2 ast", JSON.stringify(p2_ast, null, 2));
// console.log("Program 2:", JSON.stringify(evaluateAST(p2_ast), null, 2));
