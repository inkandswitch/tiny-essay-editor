import { NOT_READY } from './eval';
import './ambRenderer.css';
import { printRawValue } from './print';
import { renderToString } from 'react-dom/server';
import { isNumber, mean } from 'lodash';
import { HandsontableEditor } from 'handsontable/editors';

// Helper function to convert JSX to HTML
function jsxToHtml(Component, props = {}) {
  return renderToString(<Component {...props} />);
}

const Cell = ({ cellName, filteredResult, selectedValueIndexes }) => {
  if (!filteredResult) return '';

  const numbers = filteredResult
    .map((val) => val.value.rawValue)
    .filter(isNumber);
  const min = Math.min(...numbers);
  const avg = mean(numbers);
  const max = Math.max(...numbers);

  const valuesToShow =
    filteredResult.length < 10 ? filteredResult : filteredResult.slice(0, 3);

  return (
    <div className="flex flex-col justify-start h-full ">
      {(cellName || numbers.length > 1) && (
        <div className="text-xs text-gray-500 px-0.5 flex flex-row">
          <div>{cellName}</div>
          {numbers.length > 1 && (
            <div className="flex-shrink-0 ml-auto  text-gray-500">
              <div className="flex flex-row items-center justify-start text-xs ">
                <div className="border-r-2 border-white px-1">
                  {/* <span className="overline">x</span> = {printRawValue(avg)} */}
                  <span className="font-serif italic">x̄</span> ={' '}
                  {printRawValue(avg)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {filteredResult.length === 1 && (
        <div className="px-1">
          {printRawValue(filteredResult[0].value.rawValue)}
        </div>
      )}
      {filteredResult.length > 1 && (
        <div className="flex flex-row flex-grow items-center justify-start text-sm overflow-auto">
          {valuesToShow.map((val, i) => (
            <div
              key={i}
              className={`px-1 py-0.5 m-0.5 rounded-sm ${
                selectedValueIndexes.includes(i) ? 'bg-blue-100' : 'bg-gray-100'
              }
                      ${!val.include ? 'text-gray-300' : ''}`}
              data-context={JSON.stringify(val.context)}
              data-index={i} // Add a custom attribute to map this element to its index
            >
              {printRawValue(val.value.rawValue)}
            </div>
          ))}
          {valuesToShow.length < filteredResult.length && (
            <div className="text-xs font-medium">
              + {filteredResult.length - valuesToShow.length} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Function to bind events manually
function bindClickEvents(container, selectedValueIndexes, instance, row, col) {
  container.querySelectorAll('[data-index]').forEach((elem) => {
    const index = parseInt(elem.getAttribute('data-index'), 10);

    elem.addEventListener('click', () => {
      const valueIndex = selectedValueIndexes.indexOf(index);
      if (valueIndex > -1) {
        selectedValueIndexes.splice(valueIndex, 1);
      } else {
        selectedValueIndexes.push(index);
      }
      instance.setCellMeta(
        row,
        col,
        'selectedValueIndexes',
        selectedValueIndexes
      );
    });
  });
}

// Custom renderer function
export const ambRenderer = (
  instance,
  td,
  row,
  col,
  prop,
  value,
  cellProperties
) => {
  const filteredResult = cellProperties?.filteredResult ?? null;
  const selectedValueIndexes = cellProperties?.selectedValueIndexes ?? [];

  if (!filteredResult) {
    td.innerHTML = '';
    return td;
  }

  if (filteredResult === NOT_READY) {
    td.innerText = '!ERROR';
    return td;
  }

  // Create HTML content from the JSX component
  const contentHtml = jsxToHtml(Cell, {
    cellName: cellProperties.cellName,
    filteredResult,
    selectedValueIndexes,
  });

  // Insert the HTML content into the `td`
  td.innerHTML = contentHtml;
  td.style.padding = '0px';

  // Bind the click events manually
  bindClickEvents(td, selectedValueIndexes, instance, row, col);

  return td;
};
