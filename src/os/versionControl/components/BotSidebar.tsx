import {
  BotIcon,
  CheckIcon,
  EyeIcon,
  PencilIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import React, { useEffect, useRef } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AutomergeUrl, Doc, DocHandle } from "@automerge/automerge-repo";
import { DataType } from "@/os/datatypes";
import {
  AssistantMessage,
  ChatMessage,
  SUPPORTED_DATATYPES,
  makeBotTextEdits,
} from "../bots";
import { toast } from "sonner";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { Branch, HasVersionControlMetadata } from "../schema";
import { SidebarMode } from "./VersionControlEditor";

export type HasBotChatHistory = {
  botChatHistory: ChatMessage[];
};

// A string which will be visible to the bot representing user acceptance of edits.
// We won't show it to the user because that's weird, we'll just show something in the UI
const ACCEPT_MESSAGE = "I accept your edits.";
const REJECT_MESSAGE = "I reject your edits.";

export const BotSidebar = ({
  doc,
  handle,
  dataType,
  selectedBranch,
  setSelectedBranch,
  setSidebarMode,
  mergeBranch,
}: {
  doc: Doc<HasVersionControlMetadata<unknown, unknown>>;
  handle: DocHandle<HasVersionControlMetadata<unknown, unknown>>;
  dataType: DataType<unknown, unknown, unknown>;
  selectedBranch: Branch | undefined;
  setSelectedBranch: (branch: Branch) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  mergeBranch: (branchUrl: AutomergeUrl) => void;
}) => {
  const repo = useRepo();
  const [pendingMessage, setPendingMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!doc.botChatHistory) {
      handle.change((d) => (d.botChatHistory = []));
    }
  }, [doc.botChatHistory, handle]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [doc.botChatHistory, loading]);

  const handleUserMessage = async () => {
    const newMessage: ChatMessage = {
      role: "user",
      content: pendingMessage,
    };

    handle.change((d) => {
      d.botChatHistory.push(newMessage);
    });

    setPendingMessage("");
    setLoading(true);
    try {
      const branch = await makeBotTextEdits({
        repo,
        targetDocHandle: handle,
        // The doc object hasn't updated yet from the Automerge update above,
        // so we need to also tack on the message here.
        chatHistory: [...doc.botChatHistory, newMessage],
        dataType,
      });

      setSelectedBranch(branch);
    } catch (e) {
      toast.error("Error performing edit");
    }
    setLoading(false);
  };

  if (!SUPPORTED_DATATYPES.includes(dataType.id)) {
    return (
      <div className="p-2 text-sm text-gray-500 flex items-center justify-center h-full">
        Bots are not yet supported for datatype: {dataType.id}
      </div>
    );
  }

  if (!doc.botChatHistory) {
    return null;
  }

  const lastAssistantMessage = doc.botChatHistory
    .slice()
    .reverse()
    .find((msg) => msg.role === "assistant") as AssistantMessage;
  const showAcceptRejectButtons =
    ["assistant", "tool"].includes(
      doc.botChatHistory[doc.botChatHistory.length - 1]?.role
    ) && selectedBranch?.url === lastAssistantMessage?.branchUrl;

  const acceptSuggestion = () => {
    handle.change((d) => {
      d.botChatHistory.push({
        role: "user",
        content: ACCEPT_MESSAGE,
      });
    });
    mergeBranch(selectedBranch.url);
  };
  const rejectSuggestion = () => {
    handle.change((d) => {
      d.botChatHistory.push({
        role: "user",
        content: REJECT_MESSAGE,
      });
    });

    // need to also do the update on the main doc because we're not merging the branch...
    const mainDocHandle = repo.find<
      HasVersionControlMetadata<unknown, unknown>
    >(doc.branchMetadata.source.url);
    mainDocHandle.change((d) => {
      d.botChatHistory.push({
        role: "user",
        content: REJECT_MESSAGE,
      });
    });
    setSelectedBranch(undefined);
  };
  const reviewSuggestion = () => {
    setSidebarMode("review");
  };

  return (
    <div className="flex flex-col h-full p-2">
      <h3 className="text-sm font-medium text-gray-500 mb-2">
        <div className="flex items-center gap-2">
          <BotIcon size={16} />
          Bot Editor
          {doc.botChatHistory.length > 0 && (
            <button
              className="ml-auto text-gray-500 text-xs rounded hover:bg-gray-300"
              onClick={() =>
                handle.change((d) => {
                  d.botChatHistory = [];
                })
              }
            >
              Clear History
            </button>
          )}
        </div>
      </h3>

      <div className="flex-grow overflow-y-auto mb-2 flex flex-col">
        {doc.botChatHistory
          .filter((message) => message.role !== "tool")
          .map((message, index) => {
            if (
              message.role === "user" &&
              (message.content === ACCEPT_MESSAGE ||
                message.content === REJECT_MESSAGE)
            ) {
              return (
                <div
                  key={index}
                  className="text-sm text-gray-500 text-xs w-auto inline-block self-end mr-2"
                >
                  {message.content === ACCEPT_MESSAGE && (
                    <div className="flex items-center gap-2">
                      <CheckIcon size={16} />
                      Accepted
                    </div>
                  )}
                  {message.content === REJECT_MESSAGE && (
                    <div className="flex items-center gap-2">
                      <XIcon size={16} />
                      Rejected
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={index}
                className={`relative p-2 m-2 text-sm font-systemSans rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-500 text-white ml-auto w-2/3"
                    : "bg-gray-300 text-black mr-auto w-2/3"
                }`}
              >
                {message.content}
              </div>
            );
          })}
        {loading && (
          <div className="mt-2 text-sm text-gray-500">Loading...</div>
        )}
        {showAcceptRejectButtons && (
          <div className="flex items-center gap-2 px-2">
            <Button
              className=" bg-emerald-500 text-white flex items-center gap-2"
              onClick={acceptSuggestion}
            >
              <CheckIcon size={16} />
              Accept
            </Button>
            <Button
              className=" bg-yellow-500 text-white flex items-center gap-2"
              onClick={rejectSuggestion}
            >
              <XIcon size={16} />
              Reject
            </Button>
            <Button
              className=" bg-gray-500 text-white flex items-center gap-2"
              onClick={reviewSuggestion}
            >
              <EyeIcon size={16} />
              Review
            </Button>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="flex items-center gap-2">
        <textarea
          value={pendingMessage}
          className="flex-grow p-2 border border-gray-300 rounded h-32"
          onChange={(e) => setPendingMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleUserMessage();
            }
          }}
          placeholder="Make it more X..."
        />
        <Button onClick={handleUserMessage}>Send</Button>
      </div>
    </div>
  );
};
