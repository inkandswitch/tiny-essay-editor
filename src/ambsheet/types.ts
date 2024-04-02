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

export interface Value {
  raw: number;
  node: Node;
  operands: Value[];
}
