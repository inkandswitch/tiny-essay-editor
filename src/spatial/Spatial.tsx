import { MarkdownDoc } from "@/tee/schema";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import React, { useState, useRef, useMemo, useEffect } from "react";
import { MarkdownEditor, TextSelection } from "@/tee/components/MarkdownEditor";
import { EditorView } from "@codemirror/view";

interface Deletion {
  from: number;
  to: number;
  previousText: string;
}

const MIN_DELETE_SIZE = 10;

interface DeletionWithPosition extends Deletion {
  y: number;
  height: number;
}

export const SpatialHistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [editorView, setEditorView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);

  const [editorWidth, setEditorWidth] = useState<number>();

  // update editor width
  useEffect(() => {
    if (!editorRef) {
      return;
    }

    setEditorWidth(editorRef.current.getBoundingClientRect().width);

    const handleResize = () => {
      setEditorWidth(editorRef.current.getBoundingClientRect().width);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [editorRef.current]);

  let deletions: Deletion[] = useMemo(() => {
    if (!doc) {
      return [];
    }

    let prevHeads = [];
    let deletions: Deletion[] = [];

    A.getAllChanges(doc).forEach((change) => {
      const decodedChange = A.decodeChange(change);

      const patches = A.diff(doc, prevHeads, [decodedChange.hash]);

      for (const patch of patches) {
        const [key, index] = patch.path;

        // ignore anything that's not a change on content
        if (key !== "content") {
          continue;
        }

        switch (patch.action) {
          case "splice": {
            const from = index;
            const length = patch.value.length;
            const to = index + length;

            deletions = deletions.flatMap((deletion) => {
              // for now delete deletions if something is inserted across boundaries
              if (
                (from < deletion.from && to > deletion.from) ||
                (from < deletion.to && to > deletion.to)
              ) {
                return [];
              }

              // move if insertion happened before
              if (to < deletion.from) {
                return [
                  {
                    ...deletion,
                    from: deletion.from + length,
                    to: deletion.to + length,
                  },
                ];
              }

              // expand if insertion happened inside
              if (from >= deletion.from && from <= deletion.to) {
                return [
                  {
                    ...deletion,
                    to: deletion.to + length,
                  },
                ];
              }

              // otherwise deletion is not affected
              return [deletion];
            });

            break;
          }

          case "del": {
            const prevContent = A.view(doc, prevHeads).content;

            if (!patch.length || patch.length < MIN_DELETE_SIZE) {
              break;
            }

            deletions.push({
              from: index,
              to: index,
              previousText: prevContent.slice(index, index + patch.length),
            });
            break;
          }
        }
      }

      prevHeads = [decodedChange.hash];
    });

    return deletions;
  }, [doc]);

  const deletionsWithPosition: DeletionWithPosition[] = useMemo(() => {
    if (!editorView) {
      return [];
    }

    const topOfEditor = editorView.scrollDOM.getBoundingClientRect()?.top ?? 0;

    return deletions.map((deletion) => {
      const relativeY = editorView.coordsAtPos(deletion.from).top;
      const height = editorView.coordsAtPos(deletion.to).bottom - relativeY;

      return {
        ...deletion,
        y: relativeY,
        height,
      };
    });
  }, [deletions, editorView]);

  console.log(deletionsWithPosition);

  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="@container flex bg-gray-50 justify-center">
            <div
              className="bg-white border border-gray-200 box-border rounded-md w-full @xl:w-4/5 @xl:mt-4 @xl:mr-2 @xl:mb-8 max-w-[722px]  @xl:ml-[-100px] @4xl:ml-[-200px] px-8 py-4"
              ref={editorRef}
            >
              <MarkdownEditor
                key={docUrl}
                handle={handle}
                path={["content"]}
                setSelection={() => {}}
                setView={setEditorView}
                threadsWithPositions={[]}
                setActiveThreadId={() => {}}
                readOnly={false}
                diffStyle="normal"
              />
            </div>
            <div className="relative">
              {deletionsWithPosition.map(
                ({ previousText, y, height }, index) => {
                  return (
                    <div
                      key={index}
                      className="absolute bg-white border border-gray-200 box-border rounded-md px-8 py-4"
                      style={{
                        top: `${y}px`,
                        width: `${editorWidth}px`,
                        left: 0,
                      }}
                    >
                      {previousText}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
