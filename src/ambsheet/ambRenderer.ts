import { NOT_READY } from './eval';
import './ambRenderer.css';

export const ambRenderer = (
  instance,
  td,
  row,
  col,
  prop,
  value,
  cellProperties
) => {
  const selectedValueIndexes =
    instance.getCellMeta(row, col)['selectedValueIndexes'] || [];
  if (value === null) {
    td.innerText = '';
    return td;
  }

  if (value === NOT_READY) {
    // todo: is this right? need to consider when NOT_READY gets returned...
    td.innerText = '!ERROR';
    return td;
  }

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.justifyContent = 'flex-start';
  container.style.alignItems = 'center';
  container.style.fontSize = '16px';

  // Adjusting styles to compensate for removed gap
  container.className = 'value-container';

  value.forEach((val, i) => {
    const valueElement = document.createElement('div');
    valueElement.innerText = val.value.rawValue;
    valueElement.style.padding = '1px 4px';
    valueElement.setAttribute('data-context', JSON.stringify(val.context));
    if (!val.include) {
      valueElement.style.color = '#ddd';
    }
    if (selectedValueIndexes.includes(i)) {
      valueElement.style.background = 'rgb(255 0 0 / 10%)';
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
  td.innerHTML = '';
  td.appendChild(container);

  return td;
};
