import { NOT_READY } from './eval';
import './ambRenderer.css';
import { printRawValue } from './print';
import { renderToString } from 'react-dom/server';

// Helper function to convert JSX to HTML
function jsxToHtml(Component, props = {}) {
  return renderToString(<Component {...props} />);
}

// ValueList Component
const ValueList = ({ filteredResult, selectedValueIndexes, onClickValue }) => {
  if (!filteredResult) return '';

  return (
    <div className="flex flex-row items-center justify-start text-sm max-w-[400px] overflow-auto">
      {filteredResult.slice(0, 10).map((val, i) => (
        <div
          key={i}
          className={`px-1 py-0.5 border m-0.5 ${
            selectedValueIndexes.includes(i) ? 'bg-blue-100' : 'border-gray-200'
          }
                      ${!val.include ? 'text-gray-300' : ''}`}
          data-context={JSON.stringify(val.context)}
          data-index={i} // Add a custom attribute to map this element to its index
        >
          {printRawValue(val.value.rawValue)}
        </div>
      ))}
      {filteredResult.length > 10 && (
        <div className="whitespace-nowrap">
          ...and {filteredResult.length - 10} more
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
  const contentHtml = jsxToHtml(ValueList, {
    filteredResult,
    selectedValueIndexes,
  });

  // Insert the HTML content into the `td`
  td.innerHTML = contentHtml;

  // Bind the click events manually
  bindClickEvents(td, selectedValueIndexes, instance, row, col);

  return td;
};
