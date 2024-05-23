import { RefObject, useEffect, useMemo, useRef, useState } from "react";

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView, keymap } from "@codemirror/view";

import { automergeSyncPlugin } from "@automerge/automerge-codemirror";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { completionKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
  MarkdownDoc,
  MarkdownDocAnchor,
  ResolvedMarkdownDocAnchor,
} from "../../../datatypes/markdown/schema";
import {
  annotationDecorations,
  annotationsField,
  setAnnotationsEffect,
} from "../codemirrorPlugins/annotationDecorations";
import { codeMonospacePlugin } from "../codemirrorPlugins/codeMonospace";
import { frontmatterPlugin } from "../codemirrorPlugins/frontmatter";
import { highlightKeywordsPlugin } from "../codemirrorPlugins/highlightKeywords";
import { lineWrappingPlugin } from "../codemirrorPlugins/lineWrapping";
import { previewFiguresPlugin } from "../codemirrorPlugins/previewFigures";
import { tableOfContentsPreviewPlugin } from "../codemirrorPlugins/tableOfContentsPreview";
import { essayTheme, markdownStyles } from "../codemirrorPlugins/theme";

import { AnnotationWithUIState } from "@/os/versionControl/schema";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { AssetsDoc, HasAssets } from "../assets";
import { clickableMarkdownLinksPlugin } from "../codemirrorPlugins/clickableMarkdownLinks";
import { dragAndDropFilesPlugin } from "../codemirrorPlugins/dragAndDropFiles";
import { dropCursor } from "../codemirrorPlugins/dropCursor";
import { previewImagesPlugin } from "../codemirrorPlugins/previewMarkdownImages";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

type MarkdownInputProps = {
  value: string;

  // when no onChange handler is defined the markdown input will be readonly
  onChange?: (value: string) => void;

  // handle to the main doc which has an assets doc that we use
  // to store dragged in images
  docWithAssetsHandle?: DocHandle<HasAssets>;
};

export const MarkdownInput = ({
  value,
  onChange,
  docWithAssetsHandle,
}: MarkdownInputProps) => {
  const repo = useRepo();
  const [editorView, setEditorView] = useState(null);
  const [container, setContainer] = useState(null);
  const [remountEditor, setRemountEditor] = useState(null);

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

    let view = new EditorView({
      doc: value,
      extensions: [
        // Start with a variety of basic plugins, subset of Codemirror "basic setup" kit:
        // https://github.com/codemirror/basic-setup/blob/main/src/codemirror.ts
        history(),
        EditorView.editable.of(!!onChange),
        dropCursor(),
        indentOnInput(),
        keymap.of([
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        essayTheme,
        markdown({
          codeLanguages: languages,
        }),
        indentUnit.of("    "),
        syntaxHighlighting(markdownStyles),

        frontmatterPlugin,
        annotationsField,
        annotationDecorations,
        previewFiguresPlugin,
        docWithAssetsHandle
          ? [
              dragAndDropFilesPlugin({
                createFileReference: (file) =>
                  createFileReferenceInDoc(repo, docWithAssetsHandle, file),
              }),
              previewImagesPlugin(docWithAssetsHandle, repo),
            ]
          : [],
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
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
  }, [container, remountEditor, onChange]);

  return <div className="codemirror-editor" ref={setContainer} />;
};

export type MarkdownDocEditorProps = {
  editorContainer: HTMLDivElement;
  handle: DocHandle<MarkdownDoc>;
  path: A.Prop[];
  setSelection?: (selection: TextSelection) => void;
  setHasFocus?: (hasFocus) => void;
  setView?: (view: EditorView) => void;
  setSelectedAnchors?: (anchors: MarkdownDocAnchor[]) => void;
  readOnly?: boolean;
  docHeads?: A.Heads;
  annotations?: AnnotationWithUIState<ResolvedMarkdownDocAnchor, string>[];
  setEditorContainerElement?: (container: HTMLDivElement) => void;
};

export function MarkdownDocEditor({
  editorContainer,
  handle,
  path,
  setSelection = () => {},
  setHasFocus = () => {},
  setSelectedAnchors = () => {},
  setView = () => {},
  readOnly,
  docHeads,
  annotations,
  setEditorContainerElement,
}: MarkdownDocEditorProps) {
  const repo = useRepo();
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);
  const [editorCrashed, setEditorCrashed] = useState<boolean>(false);

  const annotationsRef = useRef<
    AnnotationWithUIState<ResolvedMarkdownDocAnchor, string>[]
  >([]);
  annotationsRef.current = annotations;

  const handleReady = handle.isReady();

  useScrollAnnotationsIntoView(annotations, editorRoot);

  // Propagate annotations into codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      // split up replaces
      effects: setAnnotationsEffect.of(annotations),
    });
  }, [annotations, editorRoot.current]);

  // This big useEffect sets up the editor view
  useEffect(() => {
    if (!handleReady || !editorContainer) {
      return;
    }
    const doc = handle.docSync();
    const docAtHeads = docHeads ? A.view(doc, docHeads) : doc;
    const source = docAtHeads.content; // this should use path

    let previousHasFocus = false;

    const view = new EditorView({
      doc: source,
      extensions: [
        EditorView.editable.of(!readOnly),
        // Start with a variety of basic plugins, subset of Codemirror "basic setup" kit:
        // https://github.com/codemirror/basic-setup/blob/main/src/codemirror.ts
        history(),

        dropCursor(),
        dragAndDropFilesPlugin({
          createFileReference: (file) =>
            createFileReferenceInDoc(repo, handle, file),
        }),
        indentOnInput(),
        keymap.of([
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        essayTheme,
        markdown({
          codeLanguages: languages,
        }),
        indentUnit.of("    "),
        syntaxHighlighting(markdownStyles),

        // Now our custom stuff: Automerge collab, comment threads, etc.
        automergeSyncPlugin({
          handle,
          path,
        }),
        frontmatterPlugin,
        annotationsField,
        annotationDecorations,
        clickableMarkdownLinksPlugin,
        previewFiguresPlugin,
        previewImagesPlugin(handle, repo),
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
      ],
      dispatch(transaction, view) {
        // TODO: can some of these dispatch handlers be factored out into plugins?
        try {
          view.update([transaction]);

          if (view.hasFocus !== previousHasFocus) {
            // hack: delay focus update because otherwise click handlers don't work on elements
            // that are hidden if the editor is not focused, because blur is triggered before click
            setTimeout(() => setHasFocus(view.hasFocus), 100);
            previousHasFocus = view.hasFocus;
          }

          // only update selection if it has changed and the editor is focused
          // if the editor is not focused it can still trigger selection changes which resets selections made through the review sidebar
          if (transaction.newSelection && view.hasFocus) {
            const selection = view.state.selection.ranges[0];

            if (selection) {
              setSelection({
                from: selection.from,
                to: selection.to,
                yCoord:
                  -1 * view.scrollDOM.getBoundingClientRect().top +
                  view.coordsAtPos(selection.from).top,
              });

              if (selection.from === selection.to) {
                const cursorPos = selection.from;
                const selectedAnnotationAnchors =
                  annotationsRef.current.flatMap((annotation) =>
                    annotation.anchor.fromPos <= cursorPos &&
                    annotation.anchor.toPos > cursorPos
                      ? [annotation.anchor]
                      : []
                  );

                setSelectedAnchors(selectedAnnotationAnchors);
              }
            } else {
              setSelectedAnchors([]);
            }
          }
        } catch (e) {
          // If we hit an error in dispatch, it can lead to bad situations where
          // the editor has crashed and isn't saving data but the user keeps typing.
          // To avoid this, we hard crash so the user knows things are broken and reloads
          // before they lose data.

          console.error(
            "Encountered an error in dispatch function; crashing the editor to notify the user and avoid data loss."
          );
          console.error(e);
          setEditorCrashed(true);
          editorRoot.current?.destroy();
        }
      },
      parent: containerRef.current,
    });

    editorRoot.current = view;

    if (setEditorContainerElement) {
      setEditorContainerElement(containerRef.current);
    }

    // pass the view up to the parent so it can use it too
    setView(view);

    view.focus();

    return () => {
      view.destroy();
    };
  }, [handle, handleReady, docHeads, editorContainer]);

  if (editorCrashed) {
    return (
      <div className="bg-red-100 p-4 rounded-md">
        <p className="mb-2">⛔️ Error: editor crashed!</p>
        {import.meta.env.MODE === "development" && (
          <p className="mb-2">Probably due to hot reload in dev.</p>
        )}
        <p className="mb-2">
          We're sorry for the inconvenience. Please reload to keep working. Your
          data was most likely saved before the crash.
        </p>
        <p className="mb-2">
          If you'd like you can screenshot the dev console as a bug report.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch min-h-screen">
      <div
        className="codemirror-editor flex-grow relative min-h-screen"
        ref={containerRef}
        onKeyDown={(evt) => {
          // Let cmd-s thru for saving the doc
          if (evt.key === "s" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          // Let cmd-\ thru for toggling the sidebar
          if (evt.key === "\\" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          // Let cmd-g thru for grouping annotations
          if (evt.key === "g" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          // Let cmd-g thru for grouping annotations
          if (evt.key === "`" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          evt.stopPropagation();
        }}
      />
    </div>
  );
}

const createFileReferenceInDoc = async (
  repo: Repo,
  handle: DocHandle<HasAssets>,
  file: File
): Promise<string> => {
  const doc = handle.docSync();
  let assetsHandle: DocHandle<AssetsDoc>;

  if (!doc.assetsDocUrl) {
    // add assets doc to old documents
    assetsHandle = repo.create<AssetsDoc>();
    assetsHandle.change((assetsDoc) => {
      assetsDoc.files = {};
    });
    handle.change((doc) => {
      doc.assetsDocUrl = assetsHandle.url;
    });
  } else {
    assetsHandle = repo.find<AssetsDoc>(doc.assetsDocUrl);
  }
  await assetsHandle.whenReady();
  const assetsDoc = assetsHandle.docSync();

  if (!isSupportedImageFile(file)) {
    alert(
      "Only the following image files are supported:\n.png, .jpg, .jpeg, .gif, .webp .bmp, .tiff, .tif"
    );
    return;
  }

  const fileAlreadyExists = assetsDoc.files[file.name];
  if (fileAlreadyExists) {
    alert(`a file with the name "${file.name}" already exists in the document`);
    return;
  }

  loadFile(file).then((contents) => {
    assetsHandle.change((assetsDoc) => {
      assetsDoc.files[file.name] = {
        contentType: file.type,
        contents,
      };
    });
  });

  return `![](./assets/${file.name})`;
};

// Scroll annotations into view when needed
const useScrollAnnotationsIntoView = (
  annotations: AnnotationWithUIState<ResolvedMarkdownDocAnchor, string>[],
  editorRoot: RefObject<EditorView>
) => {
  const annotationsToScrollIntoView = useMemo(
    () =>
      annotations.filter((annotation) => annotation.shouldBeVisibleInViewport),
    [annotations]
  );

  useEffect(() => {
    const editor = editorRoot?.current;

    // only change scroll position if editor is not focused
    if (
      !editor ||
      editor.hasFocus ||
      annotationsToScrollIntoView.length === 0
    ) {
      return;
    }

    let from = annotationsToScrollIntoView[0].anchor.fromPos;
    let to = annotationsToScrollIntoView[0].anchor.toPos;

    for (let i = 1; i < annotationsToScrollIntoView.length; i++) {
      const annotation = annotationsToScrollIntoView[i];

      if (annotation.anchor.fromPos < from) {
        from = annotation.anchor.fromPos;
      }

      if (annotation.anchor.toPos > to) {
        to = annotation.anchor.toPos;
      }
    }

    editor.dispatch({
      effects: EditorView.scrollIntoView(from, {
        y: "nearest",
        yMargin: 100,
      }),
    });

    editorRoot.current;
  }, [annotationsToScrollIntoView, editorRoot]);
};

const loadFile = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      // The file's text will be printed here
      const arrayBuffer = e.target.result as ArrayBuffer;

      // Convert the arrayBuffer to a Uint8Array
      resolve(new Uint8Array(arrayBuffer));
    };

    reader.readAsArrayBuffer(file);
  });
};

const isSupportedImageFile = (file: File) => {
  switch (file.type) {
    case "image/png":
    case "image/jpeg":
    case "image/gif":
    case "image/webp":
    case "image/bmp":
    case "image/tiff":
      return true;

    default:
      return false;
  }
};
