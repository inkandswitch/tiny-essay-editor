import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";

import { KanbanBoardDoc } from "../schema";

import Board from "react-trello";
import { useMemo } from "react";

export const KanbanBoard = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [doc, changeDoc] = useDocument<KanbanBoardDoc>(docUrl); // used to trigger re-rendering when the doc loads

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

  console.log(doc);

  return (
    <div className="h-full overflow-auto">
      <Board
        data={dataForBoard}
        draggable
        editable
        canAddLanes
        canEditLanes
        editLaneTitle
        onCardAdd={(card, laneId) =>
          changeDoc((doc) => {
            console.log(card);
            doc.cards.push({ ...card });
            const lane = doc.lanes.find((l) => l.id === laneId);
            lane.cardIds.push(card.id);
          })
        }
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
            console.log({ _cardId, newCard });
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
            console.log({
              fromLaneId,
              toLaneId,
              cardId,
              index,
              cardIds: [...fromLane.cardIds],
              oldIndex,
            });
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
        onDataChange={() => console.log("data change")}
      />
    </div>
  );
};
