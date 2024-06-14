import { BotIcon } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Doc, DocHandle } from "@automerge/automerge-repo";
import { DataType } from "@/os/datatypes";
import { SUPPORTED_DATATYPES, makeBotTextEdits } from "../bots";
import { toast } from "sonner";

type UserMessage = { role: "user"; content: string };
type AssistantMessage = { role: "assistant"; content: string | null };

type ChatMessage = UserMessage | AssistantMessage;

type HasBotChatHistory = {
  botChatHistory: ChatMessage[];
};

export const BotSidebar = ({
  doc,
  handle,
  dataType,
}: {
  doc: Doc<HasBotChatHistory>;
  handle: DocHandle<HasBotChatHistory>;
  dataType: DataType<unknown, unknown, unknown>;
}) => {
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
      const message = await makeBotTextEdits({
        targetDocHandle: handle,
        prompt: newMessage.content,
        dataType,
      });

      const botMessage: ChatMessage = {
        role: "assistant",
        content: message,
      };

      handle.change((d) => {
        d.botChatHistory.push(botMessage);
      });
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

      <div className="flex-grow overflow-y-auto mb-2">
        {doc.botChatHistory.map((message, index) => (
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
        ))}
        {loading && (
          <div className="mt-2 text-sm text-gray-500">Loading...</div>
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
