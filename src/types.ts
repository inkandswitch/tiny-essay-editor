import { MarkdownDoc } from "./schema";

export type ActionSpec = {
  [key: string]: {
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
    executeFn: (doc: MarkdownDoc, params: any) => void;
  };
};
