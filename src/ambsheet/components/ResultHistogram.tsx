import { Value } from '../eval';
import { isNumber } from 'lodash';
import { FilterSelection } from './AmbSheet';
import { Position } from '../datatype';
import { Histogram } from './Histogram';

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
  const numbers = results.map((r) => r.value.rawValue).filter(isNumber);
  const filteredNumbers = results
    .filter((n, i) => filterSelection?.selectedValueIndexes.includes(i))
    .map((n) => n.value.rawValue)
    .filter(isNumber);

  return (
    <Histogram
      data={numbers}
      filteredData={filteredNumbers}
      width={200}
      height={100}
      selectValuesBetween={(range) => {
        if (!range) {
          setFilterSelectionForCell(selectedCell, null);
        } else {
          const numbersToSelect = numbers.filter(
            (n) => n >= range.min && n <= range.max
          );

          const indexesToSelect = [];
          for (let i = 0; i < results.length; i++) {
            if (numbersToSelect.includes(results[i].value.rawValue as number)) {
              indexesToSelect.push(i);
            }
          }

          setFilterSelectionForCell(selectedCell, indexesToSelect);
        }
      }}
    />
  );
};
