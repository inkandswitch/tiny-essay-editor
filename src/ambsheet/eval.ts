import { AmbSheetDoc } from "./datatype";
import * as ohm from "ohm-js";

type Value = {
  raw: number;
  node: Node;
  operands: Value[];
};

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

function interpretBinaryOp(node, cont, op) {
  interpret(node.arg1, (val1) => {
    interpret(node.arg2, (val2) => {
      const raw = op(val1.raw, val2.raw);
      cont({
        raw,
        node: node,
        operands: [val1, val2],
      });
    });
  });
}

function interpret(node, cont) {
  switch (node.type) {
    case "NumberNode":
      cont({
        raw: node.value,
        node,
        operands: [],
      });
      break;
    case "PlusNode":
      interpretBinaryOp(node, cont, (a, b) => a + b);
      break;
    case "TimesNode":
      interpretBinaryOp(node, cont, (a, b) => a * b);
      break;
    case "MinusNode":
      interpretBinaryOp(node, cont, (a, b) => a - b);
      break;
    case "DivideNode":
      interpretBinaryOp(node, cont, (a, b) => a / b);
      break;
    // Run the continuation for each value in the AmbNode.
    case "AmbNode":
      for (const expr of node.values) {
        interpret(expr, cont);
      }
      break;
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

// The outermost continuation just collects up all results
// from the sub-paths of execution
function evaluateAST(ast) {
  const results = [];
  interpret(ast, (value) => {
    results.push(value);
  });
  return results;
}

const p1_str = "{1, 3} * 5";
const match = g.match(p1_str);
const p1_ast = semantics(match).toAst();
console.log("p1 ast", JSON.stringify(p1_ast, null, 2));
console.log("Program 1:", JSON.stringify(evaluateAST(p1_ast), null, 2));

const p2_str = "2 + {}";
const match2 = g.match(p2_str);
const p2_ast = semantics(match2).toAst();
console.log("p2 ast", JSON.stringify(p2_ast, null, 2));
console.log("Program 2:", JSON.stringify(evaluateAST(p2_ast), null, 2));

export const isFormula = (cell: string) => cell && cell[0] === "=";

export const evaluateSheet = (data: AmbSheetDoc["data"]) => {
  return data.map((row) => {
    return row.map((cell) => {
      if (isFormula(cell)) {
        const ast = semantics(g.match(cell.slice(1))).toAst();
        const result = evaluateAST(ast);
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
