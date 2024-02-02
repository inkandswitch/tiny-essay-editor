
export interface UserData {
  name: string,
  color: string
}

export interface SelectionData {
  selections: {from: number, to: number}[], 
  cursor: number 
}

export interface UserSelectionData {
  peerId: string,
  user: UserData,
  selection: SelectionData
}

export { remoteCursorTheme } from "./CursorWidget";
export { remoteStateField, setPeerSelectionData } from "./RemoteCursorsState";
export { collaborativePlugin } from "./ViewPlugin";