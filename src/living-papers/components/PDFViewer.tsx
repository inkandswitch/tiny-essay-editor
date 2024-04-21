import { useCallback, useMemo, useState } from "react";
import { useResizeObserver } from "@wojtekmaj/react-hooks";
import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// TODO: loading worker from global CDN because Vite import wasn't working,
// fix this.

// pdfjs.GlobalWorkerOptions.workerSrc = new URL(
//   "pdfjs-dist/build/pdf.worker.min.js",
//   import.meta.url
// ).toString();
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const options = {
  cMapUrl: "/cmaps/",
  standardFontDataUrl: "/standard_fonts/",
};

const resizeObserverOptions = {};

const maxWidth = 800;

export const PDFViewer = ({ data }: { data: Uint8Array }) => {
  const [numPages, setNumPages] = useState<number>();
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();

  const inputToViewer = useMemo(() => ({ data: data.slice(0) }), [data]);

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;

    if (entry) {
      setContainerWidth(entry.contentRect.width);
    }
  }, []);

  useResizeObserver(containerRef, resizeObserverOptions, onResize);

  // todo: get TS to understand the expected type for this callback
  function onDocumentLoadSuccess(pdfDocumentProxy: any): void {
    setNumPages(pdfDocumentProxy.numPages);
  }

  return (
    <div className="w-full max-w-[calc(100%-2em)] my-4" ref={setContainerRef}>
      <Document
        file={inputToViewer}
        onLoadSuccess={onDocumentLoadSuccess}
        options={options}
        className="flex flex-col items-center"
      >
        {Array.from(new Array(numPages), (el, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={
              containerWidth ? Math.min(containerWidth, maxWidth) : maxWidth
            }
            className="border border-gray-200"
          />
        ))}
      </Document>
    </div>
  );
};
