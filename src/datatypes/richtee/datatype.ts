import { next as am } from "@automerge/automerge"
import { Text } from "lucide-react";

export const init = (doc: any) => {
  doc.content = "Untitled";
  am.splitBlock(doc, ["content"], 0, {type: new am.RawString("heading"), parents: [], attrs: { level: 1}})
  doc.commentThreads = {};
};

export const getTitle = async (doc: any) => {
  const spans = am.spans(doc, ["content"])
  while (spans.length > 0) {
    const span = spans.shift()
    if (span.type === "block" && span.value.type instanceof am.RawString && span.value.type.val === "heading") {
      if (spans[0].type === "text") {
        return spans[0].value
      }
    }
  }
  return "Untitled Rich Tee"
};

export const markCopy = (doc: any) => {
  return doc
}

const RichEssayDatatype = {
  id: "rich-text",
  name: "Rich Essay",
  icon: Text,
  init,
  getTitle,
  markCopy,
};

export default RichEssayDatatype;
