import React, { useMemo, useState } from 'react';
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

  const ambDimensions = uniq(values.flatMap((v) => [...v.context.keys()]));

  console.log({ ambDimensions, evaluatedSheet });

  const [xDim, setXDim] = useState(ambDimensions[0] ?? null);
  const [yDim, setYDim] = useState(ambDimensions[1] ?? null);

  if (ambDimensions.length < 2) {
    return (
      <div className="text-xs text-gray-500">
        Need at least 2 amb dimensions to show a table
      </div>
    );
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

  const xDimChoices = evaluatedSheet[xDim.pos.row][xDim.pos.col] as Value[];
  const yDimChoices = evaluatedSheet[yDim.pos.row][yDim.pos.col] as Value[];

  console.log({ ambDimensions, xDimChoices, yDimChoices });

  return (
    <div className="grid grid-cols-2 grid-rows-2 items-center grid-rows-[auto_1fr] grid-cols-[auto_1fr]">
      <div className="col-start-1 col-end-2 row-start-1 row-end-2">
        {/* empty */}
      </div>
      <div className="col-start-2 col-end-3 row-start-1 row-end-2 text-center text-xs font-medium text-gray-500 uppercase p-1">
        <select
          className="text-xs font-medium text-gray-500 uppercase p-1"
          value={cellIndexToName(xDim.pos)}
          onChange={(e) => {
            const newXDim = ambDimensions.find(
              (dim) => cellIndexToName(dim.pos) === e.target.value
            );
            if (newXDim) {
              setXDim(newXDim);
            }
          }}
        >
          {ambDimensions.map((dim, index) => (
            <option key={index} value={cellIndexToName(dim.pos)}>
              {cellIndexToName(dim.pos)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-start-1 col-end-2 row-start-2 row-end-3  text-center text-xs font-medium text-gray-500 uppercase p-1">
        <select
          className="text-xs font-medium text-gray-500 uppercase p-1"
          value={cellIndexToName(yDim.pos)}
          onChange={(e) => {
            const newYDim = ambDimensions.find(
              (dim) => cellIndexToName(dim.pos) === e.target.value
            );
            if (newYDim) {
              setYDim(newYDim);
            }
          }}
        >
          {ambDimensions.map((dim, index) => (
            <option key={index} value={cellIndexToName(dim.pos)}>
              {cellIndexToName(dim.pos)}
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
                      [cellIndexToName(xDim.pos)]: index,
                    };
                    const filterSelectionIndexes = valuesForContext(
                      context
                    ).map((v) => v.index);
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
          <tbody className="bg-white divide-x divide-y divide-gray-200">
            {yDimChoices.map((yChoice, rowIndex) => (
              <tr key={rowIndex}>
                <td
                  className="text-center hover:bg-gray-300 text-xs font-medium text-gray-500 bg-gray-50 border-r border-gray-200 "
                  onMouseEnter={() => {
                    const context = {
                      [cellIndexToName(yDim.pos)]: rowIndex,
                    };
                    const filterSelectionIndexes = valuesForContext(
                      context
                    ).map((v) => v.index);
                    setFilterSelection(filterSelectionIndexes);
                  }}
                  onMouseLeave={() => {
                    setFilterSelection(null);
                  }}
                >
                  {yChoice.rawValue}
                </td>
                {xDimChoices.map((xChoice, colIndex) => {
                  const resultValues = valuesForContext({
                    [cellIndexToName(xDim.pos)]: colIndex,
                    [cellIndexToName(yDim.pos)]: rowIndex,
                  });
                  return (
                    <td
                      key={colIndex}
                      className={`whitespace-nowrap text-sm text-center ${
                        resultValues.some((v) =>
                          (
                            filterSelection?.selectedValueIndexes ?? []
                          ).includes(v.index)
                        )
                          ? 'bg-red-200'
                          : 'text-gray-500'
                      }`}
                      onMouseEnter={() => {
                        setFilterSelection(resultValues.map((v) => v.index));
                      }}
                    >
                      {resultValues.map((v) => v.rawValue).join(' | ')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
