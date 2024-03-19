import { useState, useCallback } from "react"
import ReactJson from "@microlink/react-json-view"
import { isValidAutomergeUrl } from "@automerge/automerge-repo"
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks"
import { next as Automerge } from "@automerge/automerge"


export function RawView({ docUrl: originalDocumentUrl }) {
  const [documentUrl, changeDocumentUrl] = useState(originalDocumentUrl)
  const [history, setHistory] = useState([]); // TODO: make these actual navigation effects? knapsack's design makes this tricky.

  const [doc, changeDoc] = useDocument(documentUrl);
  const handle = useHandle(documentUrl)
  
  const onSelectAutomergeUrl = useCallback((url) => {
    setHistory([documentUrl, ...history])
    changeDocumentUrl(url)
  }, [history, setHistory, documentUrl, changeDocumentUrl])

  const goBack = useCallback(() => {
    if (history.length === 0) { return }
    const [url, ...rest] = history
    setHistory(rest)
    changeDocumentUrl(url)
  }, [history, setHistory, changeDocumentUrl])

  const onEdit = useCallback(({namespace, new_value, name}) => {
    changeDoc(function (doc) {
      let current = doc;
      for (let i = 0; i < namespace.length; i++) {
        const key = namespace[i];
        current = current[key];
      }
      // todo: optionally use update_text?
      current[name] = new_value;
    });
  }, [changeDoc]);
  
  const onAdd = useCallback(function () { return true; }, []);
  
  const onDelete = useCallback(function ({ namespace, name }) {
    changeDoc(function (doc) {
      let current = doc;
      for (let i = 0; i < namespace.length; i++) {
        const key = namespace[i];
        current = current[key];
      }
      delete current[name];
    });
  }, [changeDoc]);

  const onSelect = useCallback(function (arg) {
    console.log("select", arg)
    const {value} = arg
    if (!(typeof value === "string")) {
      return
    }

    if (isValidAutomergeUrl(value)) {
      onSelectAutomergeUrl(value)
    }
  }, [onSelectAutomergeUrl]);
  
  // lifted from https://gist.github.com/davalapar/d0a5ba7cce4bc599f54800da22926da2
  const onDownloadDoc = useCallback(function () {
    const data = Automerge.save(doc)
    const filename = `${handle.documentId}.automerge`
    const blobURL = URL.createObjectURL(new Blob([data], {type: 'application/octet-stream'}))

    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobURL;
    tempLink.setAttribute('download', filename);

    if (typeof tempLink.download === 'undefined') {
      tempLink.setAttribute('target', '_blank');
    }

    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    setTimeout(() => {
      window.URL.revokeObjectURL(blobURL);
    }, 100);
  }, [doc, handle.documentId])

  
  if (!doc) {
    return <div>Loading ${documentUrl}...</div>
  }

  return (<>
    <h2 style={{fontWeight: "bold"}}>Current Document: {documentUrl}</h2>
    <button onClick={goBack} disabled={history.length === 0}>Back</button>
    <ReactJson 
      collapsed={3}
      src={doc}
      // @ts-expect-error - onEdit is doing something weird here
      onEdit={onEdit}
      onAdd={onAdd}
      onDelete={onDelete}
      onSelect={onSelect}
    />
    <button onClick={onDownloadDoc}>Download Automerge binary document.</button>
  </>);
}

