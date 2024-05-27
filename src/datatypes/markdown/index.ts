import { MarkdownDatatype } from './datatype.js';
export default MarkdownDatatype;

export * from './schema.js';

// todo: we should get rid of this function, we still
// use it in some places where the code is datatypes specific
export { isMarkdownDoc } from './utils.js';
