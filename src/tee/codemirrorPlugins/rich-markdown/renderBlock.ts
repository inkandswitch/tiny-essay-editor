import { Decoration, WidgetType, EditorView } from '@codemirror/view';
import { RangeSet, StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

import markdoc from '@markdoc/markdoc';

import type { Config } from '@markdoc/markdoc';
import type { DecorationSet } from '@codemirror/view'
import type { EditorState, Range } from '@codemirror/state';

const patternTag = /{%\s*(?<closing>\/)?(?<tag>[a-zA-Z0-9-_]+)(?<attrs>\s+[^]+)?\s*(?<self>\/)?%}\s*$/m;

class RenderBlockWidget extends WidgetType {
  rendered: string;

  constructor(public source: string, config: Config) {
    super();

    const document = markdoc.parse(source);
    const transformed = markdoc.transform(document, config);
    this.rendered = markdoc.renderers.html(transformed);
  }

  eq(widget: RenderBlockWidget): boolean {
    return widget.source === widget.source;
  }

  toDOM(): HTMLElement {
    let content = document.createElement('div');
    content.setAttribute('contenteditable', 'false');
    content.className = 'cm-markdoc-renderBlock';
    content.innerHTML = this.rendered;
    return content;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function replaceBlocks(state: EditorState, config: Config, from?: number, to?: number) {
  const decorations: Range<Decoration>[] = [];
  const [cursor] = state.selection.ranges;

  const tags: [number, number][] = [];
  const stack: number[] = [];

  syntaxTree(state).iterate({
    from, to,
    enter(node) {
      if (!['Table', 'Blockquote', 'MarkdocTag'].includes(node.name))
        return;

      if (node.name === 'MarkdocTag') {
        const text = state.doc.sliceString(node.from, node.to);
        const match = text.match(patternTag);

        if (match?.groups?.self) {
          tags.push([node.from, node.to]);
          return;
        }

        if (match?.groups?.closing) {
          const last = stack.pop();
          if (last) tags.push([last, node.to]);
          return;
        }

        stack.push(node.from);
        return;
      }

      if (cursor.from >= node.from && cursor.to <= node.to)
        return false;

      const text = state.doc.sliceString(node.from, node.to);
      const decoration = Decoration.replace({
        widget: new RenderBlockWidget(text, config),
        block: true,
      });

      decorations.push(decoration.range(node.from, node.to));
    }
  });

  for (let [from, to] of tags) {
    if (cursor.from >= from && cursor.to <= to) continue;
    const text = state.doc.sliceString(from, to);
    const decoration = Decoration.replace({
      widget: new RenderBlockWidget(text, config),
      block: true,
    });

    decorations.push(decoration.range(from, to));
  }

  return decorations;
}

export default function (config: Config) {
  return StateField.define<DecorationSet>({
    create(state) {
      return RangeSet.of(replaceBlocks(state, config), true);
    },

    update(decorations, transaction) {
      return RangeSet.of(replaceBlocks(transaction.state, config), true);
    },

    provide(field) {
      return EditorView.decorations.from(field);
    },
  });
}