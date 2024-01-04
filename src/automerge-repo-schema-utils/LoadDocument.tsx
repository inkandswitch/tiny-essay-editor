// A wrapper component that loads data, used like this:

import { AutomergeUrl } from "@automerge/automerge-repo";
import { useHandle } from "@automerge/automerge-repo-react-hooks";
import { Schema as S } from "@effect/schema";
import { useTypedDocument } from "./useTypedDocument";
import { LoadingScreen } from "./LoadingScreen";
import { LoadDocumentChildProps } from "./utils";
import { formatErrors } from "@effect/schema/TreeFormatter";
import { RawView } from "./RawView";

// <LoadDocument docUrl={docUrl} schema={schema}>
// {({doc, changeDoc, handle}) =>
//  <div doc={doc} changeDoc={changeDoc} handle={handle}>...</div>}
// </LoadDocument>

export const LoadDocument: React.FC<{
  docUrl: AutomergeUrl;
  schema: S.Schema<any, any>;
  children: (props: {
    doc: any;
    changeDoc: any;
    handle: any;
  }) => React.ReactNode;
}> = ({ docUrl, schema, children }) => {
  const result = useTypedDocument(docUrl, schema); // used to trigger re-rendering when the doc loads

  if (result._tag === "loading") {
    return <LoadingScreen docUrl={docUrl} handle={result.handle} />;
  }

  if (result._tag === "error") {
    return (
      <div className="p-4  h-full">
        <div className="mb-4 bg-red-100 p-4 rounded-sm">
          <div className="mb-4">
            Error: The loaded document does not conform to the expected schema.
          </div>
          <pre className=" font-mono font-bold text-sm">
            {formatErrors(result.error.errors)}
          </pre>
        </div>
        <div className="mb-4 text-sm text-gray-700">
          You can try to repair the error manually:
        </div>
        <div className="bg-white p-4">
          <RawView documentUrl={docUrl} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {children({
        doc: result.doc,
        changeDoc: result.changeDoc,
        handle: result.handle,
      })}
    </div>
  );
};

// A higher-order component that makes it more concise to use the wrapper. Use like this:
// <div>
//    {withDocument(MyChildComponent, docUrl, schema)}
// </div>

export const withDocument = (
  Component: React.FC<LoadDocumentChildProps<any>>,
  docUrl: AutomergeUrl,
  schema: S.Schema<any, any>
) => {
  return (
    <LoadDocument docUrl={docUrl} schema={schema}>
      {({ doc, changeDoc, handle }) => (
        <Component {...{ doc, changeDoc, handle }} />
      )}
    </LoadDocument>
  );
};
