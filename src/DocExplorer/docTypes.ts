import { Bot, Text } from "lucide-react";

export const docTypes = {
  essay: { name: "Essay", icon: Text },
  bot: { name: "Bot", icon: Bot },
} as const;
export type DocType = keyof typeof docTypes;
