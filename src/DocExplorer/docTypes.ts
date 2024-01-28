import { BotDocType } from "@/bots/datatype";
import { EssayDatatype } from "@/tee/datatype";

export const docTypes = {
  essay: EssayDatatype,
  bot: BotDocType,
} as const;
export type DocType = keyof typeof docTypes;
