import { DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { useMemo, useState } from "react";

import { useCurrentAccount } from "@/DocExplorer/account";
import { EditorProps } from "@/os/tools";
import { SideBySideProps } from "@/patchwork/components/PatchworkDocEditor";
import { AnnotationWithUIState } from "@/patchwork/schema";
import { next as A } from "@automerge/automerge";
import { Editor, TLCamera, TLShape, Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { TLDrawDoc, TLDrawDocAnchor } from "../../../datatypes/tldraw/schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import { useDiffStyling, useCameraSync, useAnchorEventListener } from "./hooks";

interface TLDrawProps extends EditorProps<TLDrawDocAnchor, TLShape> {
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
}

export const TLDraw = ({
  docUrl,
  docHeads,
  annotations = [],
  camera,
  onChangeCamera,
  setSelectedAnchors = () => {},
  setHoveredAnchor = () => {},
}: TLDrawProps) => {
  useDocument<TLDrawDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLDrawDoc>(docUrl);
  const account = useCurrentAccount();
  const userId = account ? account.contactHandle.url : "no-account";

  const [doc] = useDocument<TLDrawDoc>(docUrl);
  const docAtHeads = useMemo(
    () => (docHeads ? A.view(doc, docHeads) : undefined),
    [doc, docHeads]
  );

  const [localCamera, setLocalCamera] = useState<TLCamera>();

  const setCamera = (camera: TLCamera) => {
    if (onChangeCamera) {
      onChangeCamera(camera);
      return;
    }

    setLocalCamera(camera);
  };

  return (
    <div className="tldraw__editor h-full overflow-auto">
      {docHeads ? (
        docAtHeads ? (
          <ReadOnlyTLDraw
            key={JSON.stringify(docHeads)}
            userId={userId}
            doc={docAtHeads}
            annotations={annotations}
            handle={handle}
            camera={camera ?? localCamera}
            onChangeCamera={setCamera}
            setSelectedAnchors={setSelectedAnchors}
            setHoveredAnchor={setHoveredAnchor}
          />
        ) : null
      ) : (
        <EditableTLDraw
          userId={userId}
          doc={doc}
          annotations={annotations}
          handle={handle}
          camera={camera ?? localCamera}
          onChangeCamera={setCamera}
          setSelectedAnchors={setSelectedAnchors}
          setHoveredAnchor={setHoveredAnchor}
        />
      )}
    </div>
  );
};

interface TlDrawProps {
  doc: TLDrawDoc;
  handle: DocHandle<TLDrawDoc>;
  userId: string;
  annotations?: AnnotationWithUIState<TLDrawDocAnchor, TLShape>[];
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
  setSelectedAnchors: (anchors: TLDrawDocAnchor[]) => void;
  setHoveredAnchor: (anchor: TLDrawDocAnchor) => void;
}

const EditableTLDraw = ({
  doc,
  handle,
  userId,
  annotations,
  camera,
  onChangeCamera,
  setSelectedAnchors,
  setHoveredAnchor,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, annotations, store, editor });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });
  useAnchorEventListener({
    editor,
    setSelectedAnchors,
    setHoveredAnchor,
  });

  return <Tldraw autoFocus store={store} onMount={setEditor} />;
};

const ReadOnlyTLDraw = ({
  doc,
  handle,
  userId,
  annotations,
  onChangeCamera,
  camera,
  setSelectedAnchors,
  setHoveredAnchor,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, doc, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, annotations, store, editor });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });
  useAnchorEventListener({
    editor,
    setSelectedAnchors,
    setHoveredAnchor,
  });

  return (
    <Tldraw
      store={store}
      autoFocus
      onMount={(editor) => {
        setEditor(editor);
        editor.updateInstanceState({ isReadonly: true, isFocused: false });
      }}
    />
  );
};

export const SideBySide = ({
  docUrl,
  mainDocUrl,
  docHeads,
  annotations,
  setSelectedAnchors,
  setHoveredAnchor,
}: SideBySideProps<unknown, unknown>) => {
  const [camera, setCamera] = useState<TLCamera>();

  return (
    <div className="flex h-full w-full">
      <div className="h-full flex-1 overflow-auto">
        <TLDraw
          docUrl={mainDocUrl}
          key={mainDocUrl}
          annotations={[]}
          camera={camera}
          onChangeCamera={setCamera}
          setSelectedAnchors={setSelectedAnchors}
          setHoveredAnchor={setHoveredAnchor}
        />
      </div>
      <div className="h-full flex-1 overflow-auto border-l border-l-gray-200">
        <TLDraw
          docUrl={docUrl}
          docHeads={docHeads}
          key={mainDocUrl}
          annotations={
            annotations as AnnotationWithUIState<TLDrawDocAnchor, TLShape>[]
          }
          camera={camera}
          onChangeCamera={setCamera}
          setSelectedAnchors={setSelectedAnchors}
          setHoveredAnchor={setHoveredAnchor}
        />
      </div>
    </div>
  );
};
