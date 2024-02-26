import { Extension } from "@codemirror/state";
import {
  CompletionContext,
  autocompletion,
  Completion,
} from "@codemirror/autocomplete";

export function slashCommands(data: Completion[] = []): Extension {
  return autocompletion({
    override: [
      (context: CompletionContext) => {
        const word = context.matchBefore(/[/@](\w+)?/);
        if (!word) return null;
        if (word && word.from == word.to && !context.explicit) {
          return null;
        }
        return {
          from: word.from,
          options: [...data],
        };
      },
    ],
  });
}
