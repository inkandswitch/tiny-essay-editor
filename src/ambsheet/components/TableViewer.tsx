import React, { useMemo, useState } from 'react';
import {
  AmbContextWithResolvedPositions,
  FilteredResults,
  Results,
  Value,
  contextsAreCompatible,
  contextsWithResolvedPositionsAreCompatible,
  resolvePositionsInContext,
} from '../eval';
import { isNumber, max, mean, min, sum, truncate, uniq } from 'lodash';
import { FilterSelection } from './AmbSheet';
import { displayNameForCell, simpleNameForCell } from '../print';
import { Position, RawValue } from '../datatype';
import { printRawValue } from '../print';

function findAllIndexes(arr, predicate) {
  const indexes = [];

  arr.forEach((element, index) => {
    if (predicate(element)) {
      indexes.push(index);
    }
  });

  return indexes;
}

type Aggregation = 'average' | 'min' | 'max' | 'count' | 'sum';

const aggregateValues = (values: number[], aggregation: Aggregation) => {
  switch (aggregation) {
    case 'average': {
      return mean(values);
    }
    case 'min': {
      return min(values);
    }
    case 'max': {
      return max(values);
    }
    case 'count': {
      return values.length;
    }
    case 'sum': {
      return sum(values);
    }
  }
};

export const TableViewer = ({
  sheet,
  selectedCell,
  results,
  filterSelection,
  setFilterSelectionForCell,
  filteredResults,
}: {
  sheet: Env;
  selectedCell: Position;
  results: { value: Value; include: boolean }[];
  filterSelection: FilterSelection;
  setFilterSelectionForCell: (
    cell: Position,
    selectedIndexes: number[]
  ) => void;
  filteredResults: FilteredResults;
}) => {
  const [aggregation, setAggregation] = useState<Aggregation>('average');
  const valuesWithResolvedContexts = results.map((value) => ({
    ...value,
    value: {
      ...value.value,
      context: resolvePositionsInContext(value.value.context),
    },
  }));

  const ambDimensions = uniq(
    results.flatMap((v) => [...v.value.context.keys()])
  );

  const [xDim, setXDim] = useState(ambDimensions[0] ?? null);
  const [yDim, setYDim] = useState(ambDimensions[1] ?? null);

  if (ambDimensions.length < 2) {
    return (
      <div className="text-xs text-gray-400">
        Need at least 2 amb dimensions to show a table
      </div>
    );
  }

  const valuesForContext = (
    context: AmbContextWithResolvedPositions
  ): { rawValue: RawValue; include: boolean; index: number }[] => {
    const indexes = findAllIndexes(valuesWithResolvedContexts, (v) =>
      contextsWithResolvedPositionsAreCompatible(v.value.context, context)
    );

    return indexes.map((index) => ({
      rawValue: valuesWithResolvedContexts[index].value.rawValue,
      include: valuesWithResolvedContexts[index].include,
      index,
    }));
  };

  // @ts-expect-error we know that the amb literal cell for the dimension has an eval'd value
  const xDimChoices = filteredResults[xDim.pos.row][xDim.pos.col].map(
    (v) => v.value
  ) as Value[];
  // @ts-expect-error we know that the amb literal cell for the dimension has an eval'd value
  const yDimChoices = filteredResults[yDim.pos.row][yDim.pos.col].map(
    (v) => v.value
  ) as Value[];

  const hideTable = xDimChoices.length > 15 || yDimChoices.length > 15;

  return (
    <div>
      <div className="col-start-1 col-end-3 row-start-1 row-end-2 p-2">
        <label
          htmlFor="aggregation-select"
          className="text-xs font-medium text-gray-500 mr-2"
        >
          Aggregate:
        </label>
        <select
          id="aggregation-select"
          className="text-xs font-medium text-gray-500 uppercase p-1 border border-gray-300 rounded"
          value={aggregation}
          onChange={(e) => setAggregation(e.target.value as Aggregation)}
        >
          <option value="average">Average</option>
          <option value="sum">Sum</option>
          <option value="count">Count</option>
          <option value="min">Min</option>
          <option value="max">Max</option>
        </select>
      </div>
      <div className="grid grid-cols-2 grid-rows-2 items-center grid-rows-[auto_1fr] grid-cols-[auto_1fr]">
        <div className="col-start-1 col-end-2 row-start-1 row-end-2">
          {/* empty */}
        </div>
        <div className="col-start-2 col-end-3 row-start-1 row-end-2 text-center text-xs font-medium text-gray-500 p-1">
          <select
            className="text-xs font-medium text-gray-500 p-1"
            value={simpleNameForCell(xDim.pos)}
            onChange={(e) => {
              const newXDim = ambDimensions.find(
                (dim) => simpleNameForCell(dim.pos) === e.target.value
              );
              if (newXDim) {
                setXDim(newXDim);
              }
            }}
          >
            {ambDimensions.map((dim, index) => (
              <option key={index} value={simpleNameForCell(dim.pos)}>
                {displayNameForCell(dim.pos)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-1 col-end-2 row-start-2 row-end-3  text-center text-xs font-medium text-gray-500 p-1">
          <div className="block overflow-visible -rotate-90 origin-center">
            <select
              className="text-xs font-medium text-gray-500 p-1 max-w-20 -ml-4"
              value={simpleNameForCell(yDim.pos)}
              onChange={(e) => {
                const newYDim = ambDimensions.find(
                  (dim) => simpleNameForCell(dim.pos) === e.target.value
                );
                if (newYDim) {
                  setYDim(newYDim);
                }
              }}
            >
              {ambDimensions.map((dim, index) => (
                <option key={index} value={simpleNameForCell(dim.pos)}>
                  {truncate(displayNameForCell(dim.pos), {
                    length: 10,
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="col-start-2 col-end-3 row-start-2 row-end-3 overflow-auto">
          {hideTable && (
            <div className="text-xs text-gray-400">
              Too many distinct choices to display a table
            </div>
          )}

          {!hideTable && (
            <table className="min-w-full divide-x divide-y divide-gray-200 cursor-default text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-center"></th>
                  {xDimChoices.map((xChoice, index) => (
                    <th
                      key={index}
                      className="text-center text-xs font-medium text-gray-500 tracking-wider hover:bg-gray-300"
                      onMouseEnter={() => {
                        const context = {
                          [displayNameForCell(xDim.pos)]: index,
                        };
                        const filterSelectionIndexes = valuesForContext(
                          context
                        ).map((v) => v.index);
                        setFilterSelectionForCell(
                          selectedCell,
                          filterSelectionIndexes
                        );
                      }}
                      onMouseLeave={() => {
                        setFilterSelectionForCell(selectedCell, null);
                      }}
                    >
                      {printRawValue(xChoice.rawValue)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-x divide-y divide-gray-200">
                {yDimChoices.map((yChoice, rowIndex) => (
                  <tr key={rowIndex}>
                    <td
                      className="text-center hover:bg-gray-300 text-xs font-medium text-gray-500 bg-gray-50 border-r border-gray-200 "
                      onMouseEnter={() => {
                        const context = {
                          [displayNameForCell(yDim.pos)]: rowIndex,
                        };
                        const filterSelectionIndexes = valuesForContext(
                          context
                        ).map((v) => v.index);
                        setFilterSelectionForCell(
                          selectedCell,
                          filterSelectionIndexes
                        );
                      }}
                      onMouseLeave={() => {
                        setFilterSelectionForCell(selectedCell, null);
                      }}
                    >
                      {printRawValue(yChoice.rawValue)}
                    </td>
                    {xDimChoices.map((xChoice, colIndex) => {
                      const resultValues = valuesForContext({
                        [displayNameForCell(xDim.pos)]: colIndex,
                        [displayNameForCell(yDim.pos)]: rowIndex,
                      });
                      const blueHighlight = resultValues.some((v) =>
                        (filterSelection?.selectedValueIndexes ?? []).includes(
                          v.index
                        )
                      );
                      const greyOut = resultValues.every((v) => !v.include);
                      return (
                        <td
                          key={colIndex}
                          className={`whitespace-nowrap text-sm text-center ${
                            blueHighlight ? 'bg-blue-100' : ''
                          } ${greyOut ? 'text-gray-300' : ''}`}
                          onMouseEnter={() => {
                            setFilterSelectionForCell(
                              selectedCell,
                              resultValues.map((v) => v.index)
                            );
                          }}
                        >
                          <div>
                            {printRawValue(
                              aggregateValues(
                                resultValues
                                  .map((v) => v.rawValue)
                                  .filter(isNumber),
                                aggregation
                              )
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
