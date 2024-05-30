import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Module } from "@/os/modules";
import { TLShape } from "@tldraw/tldraw";
import { PenLine } from "lucide-react";
import { TLDrawDoc, TLDrawDocAnchor } from "./schema";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<TLDrawDoc, TLDrawDocAnchor, TLShape>
>({
  metadata: {
    id: "tldraw",
    name: "Drawing",
    icon: PenLine,
  },

  load: () => import("./datatype").then(({ TLDrawDatatype }) => TLDrawDatatype),
});
