import { NOT_READY } from './eval';
import './ambRenderer.css';
import { printRawValue } from './print';

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
  if (filteredResult === null) {
    td.innerText = '';
    return td;
  }

  if (filteredResult === NOT_READY) {
    // todo: is this right? need to consider when NOT_READY gets returned...
    td.innerText = '!ERROR';
    return td;
  }

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.justifyContent = 'flex-start';
  container.style.alignItems = 'center';
  container.style.fontSize = '14px';
  container.style.maxWidth = '400px';
  container.style.overflowX = 'auto';

  // Adjusting styles to compensate for removed gap
  container.className = 'value-container';

  if (filteredResult.length === 1) {
    container.innerText = filteredResult[0].value.rawValue;
    td.innerHTML = '';
    td.appendChild(container);
    return td;
  }

  filteredResult.slice(0, 10).forEach((val, i) => {
    const valueElement = document.createElement('div');
    valueElement.innerText = printRawValue(val.value.rawValue);
    valueElement.style.padding = '1px 5px';
    valueElement.style.border = '1px solid #ddd';
    valueElement.style.margin = '2px';
    valueElement.setAttribute('data-context', JSON.stringify(val.context));
    if (!val.include) {
      valueElement.style.color = '#ddd';
      valueElement.style.border = '1px solid #eee';
    }
    if (selectedValueIndexes.includes(i)) {
      valueElement.style.background = '#e5f6ff';
    }
    valueElement.addEventListener('click', () => {
      const valueIndex = selectedValueIndexes.indexOf(i);
      if (valueIndex > -1) {
        selectedValueIndexes.splice(valueIndex, 1); // Remove the value if it's already in the array
      } else {
        selectedValueIndexes.push(i); // Add the value if it's not in the array
      }
      instance.setCellMeta(
        row,
        col,
        'selectedValueIndexes',
        selectedValueIndexes
      );
    });
    container.appendChild(valueElement);
  });

  if (filteredResult.length > 10) {
    const moreElement = document.createElement('div');
    moreElement.innerText = `...and ${filteredResult.length - 10} more`;
    moreElement.style.whiteSpace = 'nowrap';
    container.appendChild(moreElement);
  }

  td.innerHTML = '';
  td.appendChild(container);

  return td;
};
