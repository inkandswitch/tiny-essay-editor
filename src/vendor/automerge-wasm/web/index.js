import url from "./automerge_wasm_bg.wasm?url";
import { initSync } from "./automerge_wasm.js";

export const promise = new Promise(resolve => {
  fetch(url).then( (response) => {
    response.arrayBuffer().then(b => {
      initSync(b)
      resolve()
    })
  });
})

export * from "./automerge_wasm.js";
