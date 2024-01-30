import { TLDrawDatatype } from "@/tldraw/datatype"
import { EssayDatatype } from "@/tee/datatype"

export const docTypes = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
} as const

export type DocType = keyof typeof docTypes
