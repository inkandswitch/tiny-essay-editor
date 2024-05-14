import { RegisteredContactDoc } from "@/os/explorer/account";
import { TinyEssayEditor } from "@/tools/essay/components/MarkdownEditor";
import { MarkdownDoc } from "@/datatypes/markdown/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { Bot } from "lucide-react";
import { EssayEditingBotDoc } from "@/datatypes/bot";
import { selectDocLink } from "@/os/explorer/hooks/useSelectedDocLink";

export const BotEditor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [doc, changeDoc] = useDocument<EssayEditingBotDoc>(docUrl);
  const [contactDoc, changeContactDoc] = useDocument<RegisteredContactDoc>(
    doc?.contactUrl
  );
  const [promptDoc] = useDocument<MarkdownDoc>(doc?.promptUrl);

  if (!doc || !contactDoc || !promptDoc) return <div>Loading...</div>;
  return (
    <div className="p-4 w-full">
      <div className="font-mono mb-6">
        <div className="mb-2 text-gray-600 uppercase font-mono">Identity</div>
        <div className="flex items-center">
          <Bot size={16} className="inline-block align-top mt-[3px] mr-2" />
          <input
            type="text"
            value={contactDoc.name}
            onChange={(e) => {
              changeContactDoc((doc) => {
                doc.name = e.target.value;
              });

              // This update doesn't actually do anything --
              // the reason we do this is so that when we update the contact doc
              // the sidebar title updates. (it's only listening to this bot doc,
              // not the contact doc)
              changeDoc((doc) => {
                doc.contactUrl = doc.contactUrl;
              });
            }}
            className="ml-2 p-1 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <div className="flex mb-2">
          <div className="text-gray-600 uppercase font-mono mr-4">Prompt</div>
          <a
            className="cursor-pointer"
            onClick={() => {
              selectDocLink({ url: doc.promptUrl, type: "essay", name: "" });
            }}
          >
            Open as doc
          </a>
        </div>
        <div className="max-h-96 overflow-y-auto border border-gray-600">
          <TinyEssayEditor docUrl={doc.promptUrl} />
        </div>
      </div>
    </div>
  );
};
