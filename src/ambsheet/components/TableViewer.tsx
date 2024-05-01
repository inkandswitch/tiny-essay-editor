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
import { chain, groupBy, max, mean, min, sum, uniq } from 'lodash';
import { FilterSelection } from './AmbSheet';
import { cellPositionToName } from '../parse';
import { Position } from '../datatype';

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
  selectedCell,
  results,
  filterSelection,
  setFilterSelectionForCell,
  filteredResults,
}: {
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
  ): { rawValue: number; include: boolean; index: number }[] => {
    const indexes = findAllIndexes(valuesWithResolvedContexts, (v) =>
      contextsWithResolvedPositionsAreCompatible(v.value.context, context)
    );

    return indexes.map((index) => ({
      rawValue: valuesWithResolvedContexts[index].value.rawValue,
      include: valuesWithResolvedContexts[index].include,
      index,
    }));
  };

  const xDimChoices = filteredResults[xDim.pos.row][xDim.pos.col].map(
    (v) => v.value
  ) as Value[];
  const yDimChoices = filteredResults[yDim.pos.row][yDim.pos.col].map(
    (v) => v.value
  ) as Value[];

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
        <div className="col-start-2 col-end-3 row-start-1 row-end-2 text-center text-xs font-medium text-gray-500 uppercase p-1">
          <select
            className="text-xs font-medium text-gray-500 uppercase p-1"
            value={cellPositionToName(xDim.pos)}
            onChange={(e) => {
              const newXDim = ambDimensions.find(
                (dim) => cellPositionToName(dim.pos) === e.target.value
              );
              if (newXDim) {
                setXDim(newXDim);
              }
            }}
          >
            {ambDimensions.map((dim, index) => (
              <option key={index} value={cellPositionToName(dim.pos)}>
                {cellPositionToName(dim.pos)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-1 col-end-2 row-start-2 row-end-3  text-center text-xs font-medium text-gray-500 uppercase p-1">
          <select
            className="text-xs font-medium text-gray-500 uppercase p-1"
            value={cellPositionToName(yDim.pos)}
            onChange={(e) => {
              const newYDim = ambDimensions.find(
                (dim) => cellPositionToName(dim.pos) === e.target.value
              );
              if (newYDim) {
                setYDim(newYDim);
              }
            }}
          >
            {ambDimensions.map((dim, index) => (
              <option key={index} value={cellPositionToName(dim.pos)}>
                {cellPositionToName(dim.pos)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-2 col-end-3 row-start-2 row-end-3 overflow-auto">
          <table className="min-w-full divide-x divide-y divide-gray-200 cursor-default text-center">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-center"></th>
                {xDimChoices.map((xChoice, index) => (
                  <th
                    key={index}
                    className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-300"
                    onMouseEnter={() => {
                      const context = {
                        [cellPositionToName(xDim.pos)]: index,
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
                    {xChoice.rawValue}
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
                        [cellPositionToName(yDim.pos)]: rowIndex,
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
                    {yChoice.rawValue}
                  </td>
                  {xDimChoices.map((xChoice, colIndex) => {
                    const resultValues = valuesForContext({
                      [cellPositionToName(xDim.pos)]: colIndex,
                      [cellPositionToName(yDim.pos)]: rowIndex,
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
                          {aggregateValues(
                            resultValues.map((v) => v.rawValue),
                            aggregation
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
