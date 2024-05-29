import { DataTypeLoaderConfig } from "@/os/datatypes";
import { Text } from "lucide-react";
import { MarkdownDoc, MarkdownDocAnchor } from "./schema";

export default {
  metadata: {
    id: "essay",
    name: "Essay",
    icon: Text,
  },

  load: () =>
    import("./datatype").then(({ MarkdownDatatype }) => MarkdownDatatype),
} as DataTypeLoaderConfig<MarkdownDoc, MarkdownDocAnchor, string>;
