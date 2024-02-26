import { keymap } from '@codemirror/view';

export const suppressSaveShortcut = keymap.of([{
  key: "Mod-s",
  run() {
    // TODO: give a nice toast
    return true;
  },
}]);
