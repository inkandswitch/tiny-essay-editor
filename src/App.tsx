import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { next as A } from "@automerge/automerge";

export interface TextDoc {
  content: string;
}

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<TextDoc>(docUrl);

  const markDoc = () => {
    changeDoc((doc: TextDoc) =>
      A.mark(
        doc,
        ["content"],
        { start: 1, end: 2, expand: "none" },
        "bold",
        true
      )
    );
  };

  if (!doc) return <></>;

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
        <p>Marks: {JSON.stringify(A.marks(doc, ["content"]))}</p>
        <p>
          Instructions: 1) type 'test' into the box, 2) click Mark, see the mark
          appear, 3) edit the text further, the marks will disappear
        </p>
      </div>
    </>
  );
}

export default App;
