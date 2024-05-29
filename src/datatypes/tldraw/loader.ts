import { DataTypeLoaderConfig } from "@/os/datatypes";
import { PenLine } from "lucide-react";
import { TLDrawDoc, TLDrawDocAnchor } from "./schema";
import { TLShape } from "@tldraw/tldraw";

export default {
  metadata: {
    id: "tldraw",
    name: "Drawing",
    icon: PenLine,
  },

  load: () => import("./datatype").then(({ TLDrawDatatype }) => TLDrawDatatype),
} as DataTypeLoaderConfig<TLDrawDoc, TLDrawDocAnchor, TLShape>;
