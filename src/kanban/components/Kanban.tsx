import { AutomergeUrl } from "@automerge/automerge-repo";

import * as A from "@automerge/automerge/next";

import { KanbanBoardDoc } from "../datatype";
import { KanbanBoardDatatype } from "../datatype";

import Board from "react-trello";
import { useMemo } from "react";
import { useDocumentWithActions } from "@/useDocumentWithActions";

export const KanbanBoard = ({
  docUrl,
  docHeads,
  readOnly,
}: {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  readOnly?: boolean;
}) => {
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
      lanes: doc.lanes.map((lane) => ({
        ...lane,
        cards: lane.cardIds.flatMap((cardId) => {
          const card = doc.cards.find((c) => c.id === cardId);
          return card ? [card] : [];
        }),
      })),
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
