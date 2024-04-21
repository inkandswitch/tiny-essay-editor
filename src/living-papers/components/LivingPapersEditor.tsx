import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import { LivingPapersDoc } from "../datatype";
import { PDFViewer } from "./PDFViewer";
import { useCallback, useEffect } from "react";
import { debounce } from "lodash";
import { Build } from "@/tee/lp-shared";

export const LivingPapersEditor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [doc, changeDoc] = useDocument<LivingPapersDoc>(docUrl);
  const handle = useHandle<LivingPapersDoc>(docUrl);
  const repo = useRepo();
  const fetchUrl = useCallback(
    debounce(async () => {
      console.log("rebuild");
      // Assuming there's a function to fetch data from a URL
      console.log(`Fetching data for docUrl: ${docUrl}`);

      const buildResult = await fetch(`http://localhost:8088/build/${docUrl}`);
      const amUrl = (await buildResult.text()) as AutomergeUrl;
      const buildDoc = (await repo.find(amUrl).doc()) as any; // Assuming BuildsDoc type is known

      const build = Object.entries(buildDoc.builds)[0][1] as Build;
      const result = build.result;
      if (result.ok === false) {
        console.error("Build failed", result.error);
        return;
      }
      const buildDirUrl = result.value.buildDirUrl;
      const buildDirDoc = (await repo.find(buildDirUrl).doc()) as any;

      console.log(buildDirDoc);

      const pdf = buildDirDoc["index.pdf"].contents;

      console.log("pdf", pdf);

      handle.change((d) => (d.pdfOutput = pdf));
    }, 1000),
    [docUrl, repo]
  );

  useEffect(() => {
    if (doc?.content) {
      fetchUrl();
    }

    // Cleanup function to cancel the debounce if the component unmounts or the doc changes
    return () => {
      fetchUrl.cancel();
    };
  }, [fetchUrl, doc.content]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-100 p-2">Settings go here</div>
      <div className="flex-grow flex">
        <div className="w-1/2 h-full border-r border-gray-200">
          <div className="bg-gray-50 py-2 px-8 text-gray-500 font-bold text-xs">
            Source
          </div>
          <TinyEssayEditor docUrl={docUrl} />
        </div>
        <div className="w-1/2 h-full bg-gray-50">
          <div className="bg-gray-50 py-2 px-8 text-gray-500 font-bold text-xs">
            Preview
          </div>
          {doc.pdfOutput && <PDFViewer data={doc.pdfOutput} />}
          {!doc.pdfOutput && <div>No PDF output yet</div>}
        </div>
      </div>
    </div>
  );
};
