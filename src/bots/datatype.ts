import { ContactDoc, RegisteredContactDoc } from "@/DocExplorer/account";
import { HasPatchworkMetadata } from "@/patchwork/schema";
import { EssayDatatype } from "@/tee/datatype";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { Bot } from "lucide-react";
import { type DataType } from "@/DocExplorer/doctypes";

const BOT_AVATAR_URL = "automerge:uL1duhieqUV4qaeHGHX1dg8FnNy" as AutomergeUrl;

export type EssayEditingBotDoc = HasPatchworkMetadata & {
  contactUrl: AutomergeUrl;
  promptUrl: AutomergeUrl;
};

export const EssayEditingBotDatatype: DataType<EssayEditingBotDoc> = {
  id: "bot",
  name: "Bot",
  icon: Bot,
  init: (doc: any, repo: Repo) => {
    const contactHandle = repo.create<RegisteredContactDoc>();
    const promptHandle = repo.create<MarkdownDoc>();

    contactHandle.change((contactDoc) => {
      contactDoc.type = "registered";
      contactDoc.name = "New Bot";
      contactDoc.avatarUrl = BOT_AVATAR_URL;
    });

    promptHandle.change((doc) => EssayDatatype.init(doc, repo));
    promptHandle.change((promptDoc) => {
      promptDoc.content = "Replace all spelling errors in the document.";
    });

    doc.contactUrl = contactHandle.url;
    doc.promptUrl = promptHandle.url;
  },
  getTitle: async (doc: any, repo: Repo) => {
    const contactDoc = await repo.find<ContactDoc>(doc.contactUrl).doc();
    return contactDoc.type === "registered" ? contactDoc.name : "Untitled Bot";
  },
  markCopy: () => {
    // TODO: maybe should reach into the contact doc and change its name here.
    // ugh that requires passing the repo in...
  },
};
