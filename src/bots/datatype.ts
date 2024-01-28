import { ContactDoc, RegisteredContactDoc } from "@/DocExplorer/account";
import { EssayDatatype } from "@/tee/datatype";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { Bot } from "lucide-react";

export type EssayEditingBot = {
  contactUrl: AutomergeUrl;
  promptUrl: AutomergeUrl;
};

export const BotDocType = {
  id: "bot",
  name: "Bot",
  icon: Bot,
  init: (doc: any, repo: Repo) => {
    const contactHandle = repo.create<RegisteredContactDoc>();
    const promptHandle = repo.create<MarkdownDoc>();

    contactHandle.change((contactDoc) => {
      contactDoc.type = "registered";
      contactDoc.name = "New Bot";
    });

    promptHandle.change((doc) => EssayDatatype.init(doc));
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
};
