import { ListFilter } from "lucide-react";
import { useState } from "react";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { ReviewStateFilter } from "../utils";

export const HistoryFilter: React.FC<{
  visibleAuthorsForEdits: AutomergeUrl[];
  setVisibleAuthorsForEdits: (authors: AutomergeUrl[]) => void;
  reviewStateFilter: ReviewStateFilter;
  setReviewStateFilter: (filter: ReviewStateFilter) => void;
  authors: AutomergeUrl[];
}> = ({
  visibleAuthorsForEdits,
  setVisibleAuthorsForEdits,
  authors,
  reviewStateFilter,
  setReviewStateFilter,
}) => {
  const [showFilterSettings, setShowFilterSettings] = useState(false);

  return (
    <div
      className={`max-w-[400px] rounded  p-4 text-sm border-opacity-0 ${
        showFilterSettings &&
        "border-opacity-100  bg-gray-50 border border-gray-200"
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            className={`flex-0 grid h-6 w-6 place-items-center rounded-full text-white ${
              showFilterSettings ? "bg-blue-500" : "bg-black"
            }`}
            onClick={() => setShowFilterSettings(!showFilterSettings)}
          >
            <ListFilter className="block" size={16} strokeWidth={2} />
          </button>
        </div>

        {showFilterSettings && (
          <FilterSettings
            authors={authors}
            visibleAuthorsForEdits={visibleAuthorsForEdits}
            setVisibleAuthorsForEdits={setVisibleAuthorsForEdits}
            reviewStateFilter={reviewStateFilter}
            setReviewStateFilter={setReviewStateFilter}
          />
        )}
      </div>
    </div>
  );
};

const FilterSettings: React.FC<{
  authors: AutomergeUrl[];
  visibleAuthorsForEdits: AutomergeUrl[];
  setVisibleAuthorsForEdits: (authors: AutomergeUrl[]) => void;
  reviewStateFilter: ReviewStateFilter;
  setReviewStateFilter: (filter: ReviewStateFilter) => void;
}> = ({
  authors,
  visibleAuthorsForEdits,
  setVisibleAuthorsForEdits,
  reviewStateFilter,
  setReviewStateFilter,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div>
          <h2 className="text-[10px] font-bold uppercase text-gray-500">
            Show edits by
          </h2>
          {authors.map((author) => (
            <div key={author} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={visibleAuthorsForEdits.includes(author)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    setVisibleAuthorsForEdits([
                      ...visibleAuthorsForEdits,
                      author,
                    ]);
                  } else {
                    setVisibleAuthorsForEdits(
                      visibleAuthorsForEdits.filter(
                        (visibleAuthor) => visibleAuthor !== author
                      )
                    );
                  }
                }}
              />
              <ContactAvatar url={author} size={"sm"} showName />
            </div>
          ))}
          <h2 className="text-[10px] font-bold uppercase text-gray-500">
            Show reviewed edits
          </h2>
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={reviewStateFilter.showReviewedBySelf}
              onChange={(e) => {
                setReviewStateFilter({
                  ...reviewStateFilter,
                  showReviewedBySelf: e.target.checked,
                });
              }}
            />
            show reviewed by me
          </div>
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={reviewStateFilter.showReviewedByOthers}
              onChange={(e) => {
                setReviewStateFilter({
                  ...reviewStateFilter,
                  showReviewedByOthers: e.target.checked,
                });
              }}
            />
            show reviewed by others
          </div>
        </div>
      </div>
    </div>
  );
};
