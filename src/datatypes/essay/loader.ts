import {
  DataTypeLoaderConfig,
  DataTypeWitoutMetaData,
  DatatypeId,
} from "@/os/datatypes";
import { Text } from "lucide-react";
import { MarkdownDoc, MarkdownDocAnchor } from "./schema";

export default {
  metadata: {
    id: "essay" as DatatypeId,
    name: "Essay",
    icon: Text,
  },

  load: () =>
    import("./datatype").then(({ MarkdownDatatype }) => MarkdownDatatype),
} as DataTypeLoaderConfig<MarkdownDoc, MarkdownDocAnchor, string>;
