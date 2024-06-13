import { Value } from '../eval';
import { isNumber } from 'lodash';
import { FilterSelection } from './AmbSheet';
import { Position } from '../datatype';
import { Histogram } from './Histogram';

import RangeSlider from 'react-range-slider-input';
import '../range-slider.css';
import { useEffect, useMemo, useState } from 'react';

export const ResultHistogram = ({
  selectedCell,
  results,
  filterSelection,
  setFilterSelectionForCell,
}: {
  selectedCell: Position;
  results: { value: Value; include: boolean }[];
  filterSelection: FilterSelection;
  setFilterSelectionForCell: (
    cell: Position,
    selectedIndexes: number[]
  ) => void;
}) => {
  const numbers = useMemo(
    () => results.map((r) => r.value.rawValue).filter(isNumber),
    [results]
  );
  const filteredNumbers = results
    .filter((n, i) => filterSelection?.selectedValueIndexes.includes(i))
    .map((n) => n.value.rawValue)
    .filter(isNumber);

  const selectValuesBetween = (range) => {
    if (!range) {
      setFilterSelectionForCell(selectedCell, null);
    } else {
      const numbersToSelect = numbers.filter(
        (n) => n >= range.min && n < range.max
      );

      const indexesToSelect = [];
      for (let i = 0; i < results.length; i++) {
        if (numbersToSelect.includes(results[i].value.rawValue as number)) {
          indexesToSelect.push(i);
        }
      }

      setFilterSelectionForCell(selectedCell, indexesToSelect);
    }
  };

  const numbersMin = useMemo(() => Math.min(...numbers), [numbers]);
  const numbersMax = useMemo(() => Math.max(...numbers), [numbers]);

  const [filterBarLimits, setFilterBarLimits] = useState<{
    min: number;
    max: number;
  }>({ min: numbersMin, max: numbersMax });

  useEffect(() => {
    setFilterBarLimits({ min: numbersMin, max: numbersMax });
  }, [numbersMin, numbersMax]);

  useEffect(() => {
    if (
      filterBarLimits.min === numbersMin &&
      filterBarLimits.max === numbersMax
    ) {
      selectValuesBetween(null);
    } else {
      selectValuesBetween(filterBarLimits);
    }
  }, [filterBarLimits]);

  if (numbers.length < 2) {
    return (
      <div className="text-gray-400 text-xs">
        Need at least two numbers to display a histogram
      </div>
    );
  }

  return (
    <div>
      <Histogram
        data={numbers}
        filteredData={filteredNumbers}
        width={200}
        height={100}
        selectValuesBetween={selectValuesBetween}
      />
      <div className="w-[200px] mt-2">
        <RangeSlider
          min={numbersMin}
          max={numbersMax}
          width={200}
          value={[filterBarLimits.min, filterBarLimits.max]}
          onInput={([min, max]) => setFilterBarLimits({ min, max })}
        />
      </div>
    </div>
  );
};
