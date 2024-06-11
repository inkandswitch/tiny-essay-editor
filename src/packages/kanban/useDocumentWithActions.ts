import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { useMemo } from "react";
import { DataType, useDataType } from "../../os/datatypes";

/** Returns a doc with helper actions from a datatype definition.
 *
 *  The datatype can define action functions in the form (doc, ...args) => { mutate doc }
 *  This hook makes those functions callable on the doc at the given url,
 *  by internally calling handle.change and calling out to the action functions.
 *  It also attaches metadata to the change tracking which action was taken.
 *
 *  NOTE: this is a small stub that may grow into a larger actions system.
 */
export const useDocumentWithActions = <D>(
  docUrl: AutomergeUrl,
  datatypeId: string
) => {
  const dataType = useDataType(datatypeId);
  const [doc, changeDoc] = useDocument<D>(docUrl);
  const handle = useHandle(docUrl);
  const actions = useMemo(() => {
    const result = {};

    if (!dataType) {
      return;
    }

    for (const [key, value] of Object.entries(dataType.actions)) {
      result[key] = (args: object) => {
        handle.change(
          (doc: D) => {
            value(doc, args);
          },
          {
            message: JSON.stringify({
              action: key,
              actionArgs: JSON.stringify(args),
            }),
          }
        );
      };
    }
    return result as Record<string, (...args: unknown[]) => void>;
  }, [dataType, handle]);
  return [doc, changeDoc, actions] as const;
};
