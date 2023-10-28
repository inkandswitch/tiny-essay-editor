import { MarkdownDoc } from "./schema";

export type ActionSpec = {
  [key: string]: {
    params: { [key: string]: "number" | "string" | "boolean" };
    executeFn: (doc: MarkdownDoc, params: any) => void;
  };
};
