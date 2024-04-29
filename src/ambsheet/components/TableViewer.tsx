import React, { useMemo } from 'react';
import {
  AmbContextWithResolvedPositions,
  Results,
  Value,
  contextsAreCompatible,
  contextsWithResolvedPositionsAreCompatible,
  resolvePositionsInContext,
} from '../eval';
import { chain, groupBy, uniq } from 'lodash';
import { FilterSelection } from './AmbSheet';
import { cellIndexToName } from '../parse';

function findAllIndexes(arr, predicate) {
  const indexes = [];

  arr.forEach((element, index) => {
    if (predicate(element)) {
      indexes.push(index);
    }
  });

  return indexes;
}

export const TableViewer = ({
  values,
  filterSelection,
  setFilterSelection,
  evaluatedSheet,
}: {
  values: Value[];
  filterSelection: FilterSelection;
  setFilterSelection: (selectedIndexes: number[]) => void;
  evaluatedSheet: Results;
}) => {
  const valuesWithResolvedContexts = values.map((value) => ({
    ...value,
    context: resolvePositionsInContext(value.context),
  }));

  // Collect the dimensions of amb choice for the values in this cell,
  // together with the unique values possible for each choice.
  // TODO: is there a better place to get these possible values from?

  const ambDimensions = uniq(values.flatMap((v) => [...v.context.keys()]));

  console.log({ ambDimensions, evaluatedSheet });

  if (ambDimensions.length < 2) {
    return <div>Not enough dimensions to show a table</div>;
  }

  const valuesForContext = (
    context: AmbContextWithResolvedPositions
  ): { rawValue: number; index: number }[] => {
    const indexes = findAllIndexes(valuesWithResolvedContexts, (v) =>
      contextsWithResolvedPositionsAreCompatible(v.context, context)
    );

    return indexes.map((index) => ({
      rawValue: valuesWithResolvedContexts[index].rawValue,
      index,
    }));
  };

  const xDim = ambDimensions[0];
  const yDim = ambDimensions[1];

  const xDimChoices = evaluatedSheet[xDim.pos.row][xDim.pos.col] as Value[];
  const yDimChoices = evaluatedSheet[yDim.pos.row][yDim.pos.col] as Value[];

  console.log({ ambDimensions, xDimChoices, yDimChoices });

  return (
    <div className="overflow-auto">
      <table className="min-w-full divide-y divide-gray-200 cursor-default text-center">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-center"></th>
            {xDimChoices.map((xChoice, index) => (
              <th
                key={index}
                className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-300"
                onMouseEnter={() => {
                  const context = {
                    [cellIndexToName(xDim.pos)]: index,
                  };
                  const filterSelectionIndexes = valuesForContext(context).map(
                    (v) => v.index
                  );
                  setFilterSelection(filterSelectionIndexes);
                }}
                onMouseLeave={() => {
                  setFilterSelection(null);
                }}
              >
                {xChoice.rawValue}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {yDimChoices.map((yChoice, rowIndex) => (
            <tr key={rowIndex}>
              <td
                className="text-center hover:bg-gray-300"
                onMouseEnter={() => {
                  const context = {
                    [cellIndexToName(yDim.pos)]: rowIndex,
                  };
                  const filterSelectionIndexes = valuesForContext(context).map(
                    (v) => v.index
                  );
                  setFilterSelection(filterSelectionIndexes);
                }}
                onMouseLeave={() => {
                  setFilterSelection(null);
                }}
              >
                {yChoice.rawValue}
              </td>
              {xDimChoices.map((xChoice, colIndex) => {
                const resultValue = valuesForContext({
                  [cellIndexToName(xDim.pos)]: colIndex,
                  [cellIndexToName(yDim.pos)]: rowIndex,
                })[0];
                return (
                  <td
                    key={colIndex}
                    className={`whitespace-nowrap text-sm text-center ${
                      (filterSelection?.selectedValueIndexes ?? []).includes(
                        resultValue.index
                      )
                        ? 'bg-red-200'
                        : 'text-gray-500'
                    }`}
                    onMouseEnter={() => {
                      setFilterSelection([resultValue.index]);
                    }}
                  >
                    {resultValue.rawValue ?? 'N/A'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
