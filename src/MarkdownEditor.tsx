import React, { useEffect, useRef } from "react";

import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { Prop } from "@automerge/automerge";
import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "@automerge/automerge-codemirror";
import { type DocHandle } from "@automerge/automerge-repo";
import { MarkdownDoc } from "./schema";

export type EditorProps = {
  handle: DocHandle<MarkdownDoc>;
  path: Prop[];
};

const theme = EditorView.theme({
  "&": {},
  ".cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    height: "100%",
  },
  ".cm-content": {
    fontFamily: '"Merriweather", serif',
    padding: "10px",
    textAlign: "justify",
  },
  ".cm-activeLine": {
    backgroundColor: "inherit",
  },
  // todo can we rely on this class name?
  ".ͼ7": {
    fontFamily: '"Merriweather Sans", sans-serif',
    fontSize: "1.3rem",
    textDecoration: "none",
    fontWeight: 300,
  },
});

export function MarkdownEditor({ handle, path }: EditorProps) {
  const containerRef = useRef(null);
  const editorRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const doc = await handle.doc();
      console.log("doc", doc);
      const source = doc.content;
      const plugin = amgPlugin(doc, path);
      const semaphore = new PatchSemaphore(plugin);
      const view = (editorRoot.current = new EditorView({
        doc: source.toString(),
        extensions: [
          basicSetup,
          plugin,
          EditorView.lineWrapping,
          theme,
          markdown({}),
        ],
        dispatch(transaction) {
          view.update([transaction]);
          semaphore.reconcile(doc, handle.changeAt.bind(handle), view);
        },
        parent: containerRef.current,
      }));

      handle.addListener("change", ({ doc }) => {
        semaphore.reconcile(doc, handle.changeAt.bind(handle), view);
      });

      return () => {
        handle.removeAllListeners();
        view.destroy();
      };
    })();
  }, []);

  return (
    <div className="flex flex-col items-stretch h-screen">
      <div
        className="codemirror-editor flex-grow relative"
        ref={containerRef}
        onKeyDown={(evt) => evt.stopPropagation()}
      />
    </div>
  );
}
