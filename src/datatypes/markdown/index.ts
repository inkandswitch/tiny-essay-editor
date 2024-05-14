import { MarkdownDatatype } from "./datatype";
export default MarkdownDatatype;

export * from "./schema";

// todo: we should get rid of this function, we still
// use it in some places where the code is datatypes specific
export { isMarkdownDoc } from "./utils";
