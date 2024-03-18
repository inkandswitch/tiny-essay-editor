import { TLDrawDatatype } from "@/tldraw/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { RawDatatype } from "@/raw/datatype";

export interface DataType {
  id: string;
  name: string;
  icon: any;
  init: (doc: any) => void;
  getTitle: (doc: any) => string;
  markCopy: (doc: any) => void;
}

export const docTypes = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
  raw: RawDatatype,
} as const;

export type DocType = keyof typeof docTypes;
