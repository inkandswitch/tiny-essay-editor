import { next as A } from "@automerge/automerge";
import { KanbanBoardDoc, KanbanBoardDocAnchor } from "./datatype";
import { EditorProps, Tool } from "@/os/tools";
import { useDocumentWithActions } from "@/packages/kanban/useDocumentWithActions";
import { useMemo } from "react";
import Board from "react-trello";
import { kanbanBoardDatatype } from "./datatype";

export const KanbanBoard = ({
  docUrl,
  docHeads,
  readOnly,
  annotations = [],
}: EditorProps<KanbanBoardDocAnchor, string> & { readOnly?: boolean }) => {
  const [latestDoc, _changeDoc, actions] =
    useDocumentWithActions<KanbanBoardDoc>(docUrl, "kanban"); // used to trigger re-rendering when the doc loads

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  const dataForBoard = useMemo(() => {
    if (!doc) {
      return { lanes: [] };
    }
    return {
      lanes: doc.lanes.map((lane) => {
        const showAsAdded = annotations.find(
          (a) =>
            a.type === "added" &&
            a.anchor.type === "lane" &&
            a.anchor.id === lane.id
        );
        return {
          ...lane,
          style: {
            backgroundColor: showAsAdded ? "#dcffe0" : "",
          },
          cards: lane.cardIds.flatMap((cardId) => {
            const card = doc.cards.find((c) => c.id === cardId);
            if (!card) return [];
            const showAsAdded = annotations.find(
              (a) =>
                a.type === "added" &&
                a.anchor.type === "card" &&
                a.anchor.id === cardId
            );
            return {
              ...card,
              style: {
                backgroundColor: showAsAdded ? "rgb(200 255 200)" : "",
              },
            };
          }),
        };
      }),
    };
  }, [doc]);

  return (
    <div className="h-full overflow-auto">
      <Board
        data={dataForBoard}
        draggable={!readOnly}
        editable={!readOnly}
        canAddLanes={!readOnly}
        canEditLanes={!readOnly}
        editLaneTitle={!readOnly}
        onCardAdd={(card, laneId) => actions.addCard({ card, laneId })}
        onCardDelete={(cardId) => actions.deleteCard({ cardId })}
        onCardUpdate={(_cardId, newCard) => actions.updateCard({ newCard })}
        onCardMoveAcrossLanes={(fromLaneId, toLaneId, cardId, index) =>
          actions.moveCard({ fromLaneId, toLaneId, cardId, index })
        }
        onLaneAdd={(lane) => actions.addLane({ lane })}
        onLaneDelete={(laneId) => actions.deleteLane({ laneId })}
        onLaneUpdate={(laneId, newLane) =>
          actions.updateLane({ laneId, newLane })
        }
      />
    </div>
  );
};

export const kanbanTool: Tool = {
  type: "patchwork:tool",
  id: "folder",
  name: "Kanban",
  supportedDataTypes: [kanbanBoardDatatype],
  editorComponent: KanbanBoard,
};
