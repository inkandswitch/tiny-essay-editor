import { HasAssets } from "@/tools/essay/assets";
import { DocHandle } from "@automerge/automerge-repo";
import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import { useMarkdownPlugins } from "./useMarkdownPlugins";
import { theme } from "./codemirrorPlugins/theme";

type MarkdownInputProps = {
  value: string;

  // when no onChange handler is defined the markdown input will be readonly
  onChange?: (value: string) => void;

  // handle to the main doc which has an assets doc that we use
  // to store dragged in images
  docWithAssetsHandle?: DocHandle<HasAssets>;
};

export const BASE_EXTENSIONS = [];

export const MarkdownInput = ({
  value,
  onChange,
  docWithAssetsHandle,
}: MarkdownInputProps) => {
  const [editorView, setEditorView] = useState(null);
  const [container, setContainer] = useState(null);
  const [remountEditor, setRemountEditor] = useState(null);
  const plugins = useMarkdownPlugins({ docWithAssetsHandle });

  // trigger a remount when value has changed from the outside
  useEffect(() => {
    if (editorView && editorView.state.doc.toString() !== value) {
      setRemountEditor({});
    }
  }, [value, editorView]);

  useEffect(() => {
    if (!container) {
      return;
    }

    const view = new EditorView({
      doc: value,
      extensions: [
        ...plugins,
        theme("sans"),
        EditorView.editable.of(onChange !== undefined),
        onChange
          ? EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChange(update.state.doc.toString());
              }
            })
          : [],
      ],

      parent: container,
    });

    view.focus();

    setEditorView(view);

    return () => {
      view.destroy();
    };
  }, [container, remountEditor, onChange, plugins]);

  return <div className="codemirror-editor" ref={setContainer} />;
};
