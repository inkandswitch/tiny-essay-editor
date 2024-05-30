import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Text } from "lucide-react";
import { MarkdownDoc, MarkdownDocAnchor } from "./schema";
import { Module } from "@/os/modules";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<MarkdownDoc, MarkdownDocAnchor, string>
>({
  metadata: {
    id: "essay",
    name: "Essay",
    icon: Text,
  },

  load: () =>
    import("./datatype").then(({ MarkdownDatatype }) => MarkdownDatatype),
});
