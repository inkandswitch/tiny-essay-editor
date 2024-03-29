import { uuid } from '@automerge/automerge'
import * as A from "@automerge/automerge/next";

import { CalendarDoc, CalendarDocAnchor, CalendarDatatype, Event } from "../datatype";

import moment from 'moment';
import { Calendar, Views, DateLocalizer, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import 'react-big-calendar/lib/css/react-big-calendar.css';

import React, { useMemo } from "react";
import { useDocumentWithActions } from "@/useDocumentWithActions";
import { DocEditorProps } from "@/DocExplorer/doctypes";

const mLocalizer = momentLocalizer(moment)

const ColoredDateCellWrapper = ({ children }) =>
React.cloneElement(React.Children.only(children), {
  style: {
    backgroundColor: 'lightblue',
  },
})

const DnDCalendar = withDragAndDrop(Calendar)

export const MyCalendar = ({
  docUrl,
  docHeads,
}: DocEditorProps<CalendarDocAnchor, string> & { readOnly?: boolean }) => {
  const [latestDoc, _changeDoc, actions] =
    useDocumentWithActions<CalendarDoc>(docUrl, CalendarDatatype); // used to trigger re-rendering when the doc loads

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  const defaultDate = useMemo(() => new Date(), [])

  if (!doc) {
    return null;
  }

  const onSelectSlot = data => {
    const title = prompt('What is the title of the new Event?')
    if (title) {
      const event: Event = {id: uuid(), title, start: data.start, end: data.end}
      actions.addEvent({event})
    }
  }
  
  const onEventDrop: withDragAndDropProps['onEventDrop'] = data => {
    const { event, start, end, isAllDay, resourceId } = data
    event.start = start
    event.end = end
    actions.updateEvent({event})
  }

  const onDoubleClickEvent = event => {
    const title = prompt('What is the new title of the new Event? (enter "delete" to delete it)', event.title)
    if (title) {
      if (title === 'delete') {
        actions.deleteEvent({event})
      } else {
        event.title = title
        actions.updateEvent({event})
      }
    }
  }

  const onEventResize: withDragAndDropProps['onEventResize'] = data => {
    const { event, start, end } = data
    event.start = start
    event.end = end
    actions.updateEvent({event})
  }
  
  return (
    <div className="h-full overflow-auto" style={{height: '100%'}}>
        <DnDCalendar
          defaultDate={defaultDate}
          events={doc.events}
          localizer={mLocalizer}
          resizable
          selectable
          showMultiDayTimes
          step={60}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          onSelectSlot={onSelectSlot}
          onDoubleClickEvent={onDoubleClickEvent}
        />
      </div>
  )
}
