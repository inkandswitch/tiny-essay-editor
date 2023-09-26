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

  const addChar = () => {
    const randomIndex = Math.floor(Math.random() * doc.content.length);
    const randomChar = String.fromCharCode(Math.floor(Math.random() * 26) + 97);
    changeDoc((doc: TextDoc) =>
      A.splice(doc, ["content"], randomIndex, 0, randomChar)
    );
  };

  if (!doc) return <></>;

  return (
    <>
      <h1>Vite React Automerge app</h1>
      <p>
        This is an editable text box, and a debug view of marks on the text box.
      </p>
      <p>
        Instructions: 1) type 'test' into the box, 2) click Mark, see the mark
        appear, 3) edit the text further, the marks will disappear
      </p>
      <div className="card">
        <input
          value={doc ? doc.content : ""}
          onChange={(e) => changeDoc((d) => (d.content = e.target.value))}
        />
        <button onClick={markDoc}>Mark</button>
        <button onClick={addChar}>Add Char</button>
        <p>Marks: {JSON.stringify(A.marks(doc, ["content"]))}</p>
      </div>
    </>
  );
}

export default App;
