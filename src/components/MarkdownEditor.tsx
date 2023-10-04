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
import { MarkdownDoc } from "../schema";

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
    const doc = handle.docSync();
    const source = doc.content; // this should use path
    const plugin = amgPlugin(doc, path);
    const semaphore = new PatchSemaphore(plugin);
    const view = new EditorView({
      doc: source,
      extensions: [
        basicSetup,
        plugin,
        EditorView.lineWrapping,
        theme,
        markdown({}),
      ],
      dispatch(transaction) {
        view.update([transaction]);
        semaphore.reconcile(handle, view);
      },
      parent: containerRef.current,
    });

    // todo: what's going on with this typecast?
    editorRoot.current = view as unknown as HTMLDivElement;

    handle.addListener("change", () => {
      semaphore.reconcile(handle, view);
    });

    return () => {
      handle.removeAllListeners();
      view.destroy();
    };
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
