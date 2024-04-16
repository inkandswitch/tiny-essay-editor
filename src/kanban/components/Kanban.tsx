import { AutomergeUrl } from "@automerge/automerge-repo";

import * as A from "@automerge/automerge/next";

import { KanbanBoardDoc, KanbanBoardDocAnchor } from "../datatype";
import { KanbanBoardDatatype } from "../datatype";

import Board from "react-trello";
import { useMemo } from "react";
import { useDocumentWithActions } from "@/useDocumentWithActions";
import { DocEditorProps } from "@/DocExplorer/doctypes";

export const KanbanBoard = ({
  docUrl,
  docHeads,
  readOnly,
  annotations,
}: DocEditorProps<KanbanBoardDocAnchor, string> & { readOnly?: boolean }) => {
  const [latestDoc, _changeDoc, actions] =
    useDocumentWithActions<KanbanBoardDoc>(docUrl, KanbanBoardDatatype); // used to trigger re-rendering when the doc loads

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
