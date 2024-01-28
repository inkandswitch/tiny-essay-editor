export const docTypes = ["essay"] as const; // | ... | future other types
export type DocType = (typeof docTypes)[number];
