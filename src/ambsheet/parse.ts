import * as ohm from 'ohm-js';
import { Position, RawValue } from './datatype';

export const isFormula = (cell: string) => cell && cell[0] === '=';

export type AmbNode = {
  type: 'amb';
  pos: Position;
  parts: AmbNodePart[];
};

export type AmbNodePart =
  | { type: 'repeat'; value: RawValue; numRepeats: number }
  | { type: 'range'; from: number; to: number; step: number };

type AddressingMode = 'relative' | 'absolute';
export type RefNode = {
  type: 'ref';
  rowMode: AddressingMode;
  colMode: AddressingMode;
} & Position;

export type Node =
  | { type: 'rawValueLiteral'; value: number }
  | AmbNode
  | RefNode
  | { type: '='; left: Node; right: Node }
  | { type: '>'; left: Node; right: Node }
  | { type: '>='; left: Node; right: Node }
  | { type: '<'; left: Node; right: Node }
  | { type: '<='; left: Node; right: Node }
  | { type: '+'; left: Node; right: Node }
  | { type: '-'; left: Node; right: Node }
  | { type: '*'; left: Node; right: Node }
  | { type: '/'; left: Node; right: Node }
  | { type: 'if'; cond: Node; then: Node; else: Node }
  | { type: 'call'; funcName: string; args: Node[] };

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
      = caseInsensitive<"if"> "(" Exp "," Exp "," Exp ")"  -- if
      | name "(" ListOf<Exp, ","> ")"                      -- call
      | UnExp

    UnExp
      = "-" PriExp  -- neg
      | PriExp

    PriExp
      = "{" ListOf<AmbPart, ","> "}"  -- amb
      | "(" Exp ")"                   -- paren
      | cellRef
      | RawValueLiteral

    AmbPart
      = number "to" number "by" number  -- rangeWithStep
      | number "to" number              -- rangeAutoStep
      | number "x" digit+               -- repeated
      | number                          -- single

    RawValueLiteral
      = number

    number  (a number)
      = "-" unsignedNumber   -- negative
      | "+"? unsignedNumber  -- positive

    unsignedNumber
      = digit* "." digit+  -- fract
      | digit+             -- whole

    cellRef
      = "$"? letter "$"? digit+

    name
      = letter alnum*
  }
`;

const g = ohm.grammar(grammarSource);

// console.log("match", g.match("=1 + {2, 3}").succeeded());
// console.log("match", g.match("=-1 + {2, 3}").succeeded());
// console.log("match", g.match("=1 + {2, (3 + 4)}").succeeded());

// this is hacky, but it's convenient...
let pos = { row: 0, col: 0 };

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
  CallExp_call(fnName, _lparen, args, _rparen) {
    return {
      type: 'call',
      funcName: fnName.sourceString.toLowerCase(),
      args: args.toAst(),
    };
  },
  UnExp_neg(_op, exp) {
    return {
      type: '-',
      left: { type: 'rawValueLiteral', value: 0 },
      right: exp.toAst(),
    };
  },
  number(n) {
    return parseFloat(n.sourceString);
  },
  PriExp_amb(_lbrace, list, _rbrace) {
    return {
      type: 'amb',
      pos,
      parts: list.toAst(),
    };
  },
  PriExp_paren(_lparen, exp, _rparen) {
    return exp.toAst();
  },
  AmbPart_repeated(exp, _x, n) {
    return {
      type: 'repeat',
      value: exp.toAst(),
      numRepeats: parseInt(n.sourceString),
    };
  },
  AmbPart_single(exp) {
    return { type: 'repeat', value: exp.toAst(), numRepeats: 1 };
  },
  AmbPart_rangeAutoStep(fromNode, _sep, toNode) {
    const from = parseFloat(fromNode.sourceString);
    const to = parseFloat(toNode.sourceString);
    return { type: 'range', from, to, step: from < to ? 1 : -1 };
  },
  AmbPart_rangeWithStep(from, _to, to, _by, step) {
    return {
      type: 'range',
      from: parseFloat(from.sourceString),
      to: parseFloat(to.sourceString),
      step: parseFloat(step.sourceString),
    };
  },
  RawValueLiteral(v) {
    return { type: 'rawValueLiteral', value: v.toAst() };
  },
  cellRef(cDollar, c, rDollar, r) {
    const rowMode = rDollar.sourceString === '$' ? 'absolute' : 'relative';
    const colMode = cDollar.sourceString === '$' ? 'absolute' : 'relative';
    return {
      type: 'ref',
      rowMode,
      row:
        parseInt(r.sourceString) - 1 - (rowMode === 'absolute' ? 0 : pos.row),
      colMode,
      col:
        c.sourceString.toUpperCase().charCodeAt(0) -
        'A'.charCodeAt(0) -
        (colMode === 'absolute' ? 0 : pos.col),
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

export function parseFormula(formula: string, cellPos: Position): Node {
  // TODO: throw on parse error
  const match = g.match(formula);
  pos = cellPos;
  return semantics(match).toAst();
}

// Get a human readable cell name like B2 given a row and col.
// Might extend this in the future to support custom cell names?
export const cellIndexToName = (pos: Position) =>
  `${String.fromCharCode(65 + pos.col)}${pos.row + 1}`;
