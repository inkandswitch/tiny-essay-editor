// TODO: add boolean operators
// TODO: add string operators + functions

import * as ohm from 'ohm-js';
import { Position, RawValue } from './datatype';

export const isFormula = (cell: string) => cell?.startsWith('=');

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
  | AmbNode
  | RefNode
  | { type: 'const'; value: number }
  | { type: '='; left: Node; right: Node }
  | { type: '<>'; left: Node; right: Node }
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
      | AddExp "<>" AddExp  -- neq
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
      = if "(" Exp "," Exp "," Exp ")"  -- if
      | ident "(" ListOf<Exp, ","> ")"  -- call
      | UnExp

    UnExp
      = "-" PriExp  -- neg
      | PriExp

    PriExp
      = "{" ListOf<AmbPart, ","> "}"  -- amb
      | "(" Exp ")"                   -- paren
      | const                         -- const
      | cellRef

    AmbPart
      = number to number by number  -- rangeWithStep
      | number to number            -- rangeAutoStep
      | const x digit+              -- repeated
      | const                       -- single

    const
      = number
      | boolean
      | string

    number  (a number)
      = "-" unsignedNumber   -- negative
      | "+"? unsignedNumber  -- positive

    unsignedNumber
      = digit* "." digit+  -- fract
      | digit+             -- whole

    boolean
      = true   -- true
      | false  -- false

    string  (a string literal)
      = "\"" (~"\"" ~"\n" any)* "\""

    cellRef
      = "$"? letter "$"? digit+

    ident  (an identifier)
      = letter alnum*

    // keywords
    by = caseInsensitive<"by"> ~alnum
    if = caseInsensitive<"if"> ~alnum
    false = caseInsensitive<"false"> ~alnum
    to = caseInsensitive<"to"> ~alnum
    true = caseInsensitive<"true"> ~alnum
    x = caseInsensitive<"x"> ~letter
  }
`;

const g = ohm.grammar(grammarSource);

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
  RelExp_neq(left, _op, right) {
    return {
      type: '<>',
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
      left: { type: 'const', value: 0 },
      right: exp.toAst(),
    };
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
  PriExp_const(v) {
    return { type: 'const', value: v.toAst() };
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
  number(n) {
    return parseFloat(n.sourceString);
  },
  boolean_true(_t) {
    return true;
  },
  boolean_false(_f) {
    return false;
  },
  string(_oq, csNode, _cq) {
    const cs: string[] = csNode.toAST();
    const chars: string[] = [];
    let idx = 0;
    while (idx < cs.length) {
      let c = cs[idx++];
      if (c === '\\' && idx < cs.length) {
        c = cs[idx++];
        switch (c) {
          case 'n':
            c = '\n';
            break;
          case 't':
            c = '\t';
            break;
          default:
            idx--;
        }
      }
      chars.push(c);
    }
    return chars.join('');
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
