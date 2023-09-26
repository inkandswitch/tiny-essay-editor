import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { next as A } from "@automerge/automerge";

interface TextDoc {
  content: string;
}

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<TextDoc>(docUrl);

  const markDoc = () => {
    changeDoc((doc: TextDoc) =>
      A.mark(
        doc,
        ["content"],
        { start: 0, end: 2, expand: "none" },
        "bold",
        true
      )
    );
  };

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <input
          value={doc ? doc.content : ""}
          onChange={(e) => changeDoc((d) => (d.content = e.target.value))}
        />
        <button onClick={markDoc}>Mark</button>
        <p>Marks: {A.marks(doc, ["content"]).length} marks</p>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
