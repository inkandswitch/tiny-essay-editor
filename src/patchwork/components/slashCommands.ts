import { Extension } from "@codemirror/state";
import {
  CompletionContext,
  autocompletion,
  Completion,
} from "@codemirror/autocomplete";

export const createMentionCompletion = (name: string) => ({
  label: `@${name}`,
  apply: createApplyWithSpaceAfterCompletion(`@${name}`),
});

export const createSlashCommandCompletion = (name: string, info?: string) => ({
  label: `/${name}`,
  info,
  apply: createApplyWithSpaceAfterCompletion(`/${name}`),
});

export function createApplyWithSpaceAfterCompletion(label: string) {
  return function (view, completion, from, to) {
    const insertText = label;
    view.dispatch({
      changes: { from, to, insert: `${insertText} ` },
      selection: {
        anchor: from + insertText.length + 1,
        head: from + insertText.length + 1,
      },
    });
  };
}

export function createApplyWithBracketSelection(label) {
  return function (view, completion, from, to) {
    const insertText = label;
    const startBracketIndex = insertText.indexOf("[");
    const endBracketIndex = insertText.indexOf("]");

    // Ensure there are brackets to select text between.
    if (startBracketIndex !== -1 && endBracketIndex !== -1) {
      view.dispatch({
        changes: { from, to, insert: insertText },
        selection: {
          anchor: from + startBracketIndex,
          head: from + endBracketIndex + 1,
        },
      });
    }
  };
}

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
