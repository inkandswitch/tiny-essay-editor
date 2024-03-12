import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";

import { KanbanBoardDoc } from "../schema";
import { KanbanBoardDatatype } from "../datatype";

import Board from "react-trello";
import { useMemo } from "react";

export const KanbanBoard = ({
  docUrl,
  docHeads,
  readOnly,
}: {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  readOnly?: boolean;
}) => {
  const [latestDoc, changeDoc] = useDocument<KanbanBoardDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<KanbanBoardDoc>(docUrl);

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
        cards: lane.cardIds.map((cardId) =>
          doc.cards.find((c) => c.id === cardId)
        ),
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
        onCardAdd={(card, laneId) => {
          KanbanBoardDatatype.methods.addCard(handle, card, laneId);
        }}
        onCardDelete={(cardId) =>
          changeDoc((doc) =>
            doc.cards.splice(
              doc.cards.findIndex((card) => card.id === cardId),
              1
            )
          )
        }
        onCardUpdate={(_cardId, newCard) =>
          changeDoc((doc) => {
            const card = doc.cards.find((card) => card.id === newCard.id);
            if (newCard.title && newCard.title !== card.title) {
              card.title = newCard.title;
            }
            if (
              newCard.description &&
              newCard.description !== card.description
            ) {
              card.description = newCard.description;
            }
          })
        }
        onCardMoveAcrossLanes={(fromLaneId, toLaneId, cardId, index) =>
          changeDoc((doc) => {
            const fromLane = doc.lanes.find((l) => l.id === fromLaneId);
            const toLane = doc.lanes.find((l) => l.id === toLaneId);

            // TODO: this doesn't work if we don't copy the array; why? automerge bug?
            const oldIndex = [...fromLane.cardIds].indexOf(cardId);
            fromLane.cardIds.splice(oldIndex, 1);
            toLane.cardIds.splice(index, 0, cardId);
          })
        }
        onLaneAdd={(lane) =>
          changeDoc((doc) => doc.lanes.push({ ...lane, cardIds: [] }))
        }
        onLaneDelete={(laneId) =>
          changeDoc((doc) =>
            doc.lanes.splice(
              doc.lanes.findIndex((l) => l.id === laneId),
              1
            )
          )
        }
        onLaneUpdate={(laneId, newLane) => {
          changeDoc((doc) => {
            const lane = doc.lanes.find((l) => l.id === laneId);
            if (newLane.title && newLane.title !== lane.title) {
              lane.title = newLane.title;
            }
          });
        }}
      />
    </div>
  );
};
