import { Extension } from "@codemirror/state";

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView, keymap } from "@codemirror/view";

import { completionKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { foldKeymap, indentOnInput, indentUnit } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { codeMonospacePlugin } from "./codemirrorPlugins/codeMonospace";
import { lineWrappingPlugin } from "./codemirrorPlugins/lineWrapping";

import { AssetsDoc, HasAssets } from "@/tools/essay/assets";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { useMemo } from "react";
import { dragAndDropFilesPlugin } from "./codemirrorPlugins/dragAndDropFiles";
import { dropCursor } from "./codemirrorPlugins/dropCursor";
import { previewImagesPlugin } from "./codemirrorPlugins/previewMarkdownImages";

type MarkdownPluginsConfig = { docWithAssetsHandle?: DocHandle<HasAssets> };

export const useMarkdownPlugins = ({
  docWithAssetsHandle,
}: MarkdownPluginsConfig): Extension[] => {
  const repo = useRepo();

  return useMemo(() => {
    return [
      history(),
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
      markdown({
        codeLanguages: languages,
      }),
      indentUnit.of("    "),
      docWithAssetsHandle
        ? [
            dragAndDropFilesPlugin({
              createFileReference: (file) =>
                createFileReferenceInDoc(repo, docWithAssetsHandle, file),
            }),
            previewImagesPlugin(docWithAssetsHandle, repo),
          ]
        : [],
      codeMonospacePlugin,
      lineWrappingPlugin,
    ];
  }, [repo, docWithAssetsHandle]);
};

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
