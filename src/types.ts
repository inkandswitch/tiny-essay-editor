import { MarkdownDoc } from "./schema";
import { ChangeFn } from "@automerge/automerge";

export type ActionSpec = {
  parameters: {
    type: "object";
    properties: {
      // TODO: this should probably support arbitrary JSON schema as input parameters.
      // The only reason I haven't done that yet is that my UI form logic is dumb and simple.
      // We can switch to a generic JSON schema form builder maybe.
      [key: string]:
        | {
            type: "string";
          }
        | { type: "number" }
        | { type: "boolean" };
    };
  };
  executeFn: (
    changeDoc: (fn: ChangeFn<MarkdownDoc>) => void,
    params: any
  ) => void;
};
