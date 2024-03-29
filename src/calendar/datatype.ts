import { DataType } from "@/DocExplorer/doctypes";
import { uuid } from "@automerge/automerge";
import { next as A } from "@automerge/automerge";
import { Calendar } from "lucide-react";
import {
  Annotation,
  HasPatchworkMetadata,
  initPatchworkMetadata,
} from "@/patchwork/schema";
import { ChangeGroup } from "@/patchwork/groupChanges";

export type Event = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  // resource?: any;
};

export type CalendarDocAnchor =
  | { type: "card"; id: string }
  | { type: "lane"; id: string };

export type CalendarDoc = {
  title: string;
  events: Event[];
} & HasPatchworkMetadata<never, never>;

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
export const markCopy = () => {
  console.error("todo");
};

const getTitle = (doc: any) => {
  return doc.title;
};

export const init = (doc: any) => {
  doc.title = "Untitled Calendar";
  doc.events = [];

  initPatchworkMetadata(doc);
};

const patchesToAnnotations = (
  doc: CalendarDoc,
  docBefore: CalendarDoc,
  patches: A.Patch[]
) => {
  return []
};

const fallbackSummaryForChangeGroup = (
  changeGroup: ChangeGroup<CalendarDoc>
) => {
  return 'something changed...';
};

const actions = {
  addEvent: (doc, { event }: { event: Event }) => {
    doc.events.push({ ...event });
  },
  deleteEvent: (doc, { id }: { id: string }) => {
    doc.events.splice(
      doc.events.findIndex((event) => event.id === id),
      1
    );
  },
  updateEvent: (doc, { event }: { event: Event }) => {
    const oldEvent = doc.events.find((ev) => ev.id === event.id);
    if (event.title != oldEvent.title) { oldEvent.title = event.title }
    if (event.start != oldEvent.start) { oldEvent.start = event.start }
    if (event.end != oldEvent.end) { oldEvent.end = event.end }
    if (event.allDay != oldEvent.allDay) { oldEvent.allDay = event.allDay }
  },
};

export const CalendarDatatype: DataType<
  CalendarDoc,
  CalendarDocAnchor,
  undefined
> = {
  id: "calendar",
  name: "Calendar",
  icon: Calendar,
  init,
  getTitle,
  markCopy,
  fallbackSummaryForChangeGroup,
  actions,
  patchesToAnnotations,
};
