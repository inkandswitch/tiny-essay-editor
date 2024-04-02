import * as ohm from 'ohm-js';

export const isFormula = (cell: string) => cell && cell[0] === '=';

export type Node =
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

const grammarSource = String.raw`
  AmbSheets {
    Formula = "=" Exp

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

    number  (a number)
      = digit* "." digit+  -- fract
      | digit+             -- whole
  }
`;

const g = ohm.grammar(grammarSource);

// console.log("match", g.match("=1 + {2, 3}").succeeded());
// console.log("match", g.match("=-1 + {2, 3}").succeeded());
// console.log("match", g.match("=1 + {2, (3 + 4)}").succeeded());

const semantics = g.createSemantics().addOperation('toAst', {
  Formula(_eq, exp) {
    return exp.toAst();
  },

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

export function parseFormula(formula: string): Node {
  // TODO: throw on parse error
  const match = g.match(formula);
  return semantics(match).toAst();
}
