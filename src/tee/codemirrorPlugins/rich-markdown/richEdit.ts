import { Decoration, PluginValue } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state';

const tokenElement = [
  'InlineCode',
  'Emphasis',
  'StrongEmphasis',
  'FencedCode',
  'Link',
];

const tokenHidden = [
  'HardBreak',
  'LinkMark',
  'EmphasisMark',
  'CodeMark',
  'CodeInfo',
  'URL',
];

const decorationHidden = Decoration.mark({ class: 'cm-markdoc-hidden' });
const decorationBullet = Decoration.mark({ class: 'cm-markdoc-bullet' });
const decorationCode = Decoration.mark({ class: 'cm-markdoc-code' });
const decorationTag = Decoration.mark({ class: 'cm-markdoc-tag' });

export default class RichEditPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.process(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet)
      this.decorations = this.process(update.view);
  }

  process(view: EditorView): DecorationSet {
    let widgets: Range<Decoration>[] = [];
    let [cursor] = view.state.selection.ranges;

    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from, to,
        enter(node) {
          if (node.name === 'MarkdocTag')
            widgets.push(decorationTag.range(node.from, node.to));

          if (node.name === 'FencedCode')
            widgets.push(decorationCode.range(node.from, node.to));

          if ((node.name.startsWith('ATXHeading') || tokenElement.includes(node.name)) &&
            cursor.from >= node.from && cursor.to <= node.to)
            return false;

          if (node.name === 'ListMark' && node.matchContext(['BulletList', 'ListItem']) &&
            cursor.from != node.from && cursor.from != node.from + 1)
            widgets.push(decorationBullet.range(node.from, node.to));

          if (node.name === 'HeaderMark')
            widgets.push(decorationHidden.range(node.from, node.to + 1));

          if (tokenHidden.includes(node.name))
            widgets.push(decorationHidden.range(node.from, node.to));
        }
      });
    }

    return Decoration.set(widgets);
  }
}

