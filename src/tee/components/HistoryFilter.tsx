import {
  Clock4,
  EditIcon,
  FolderOpenIcon,
  ListFilter,
  MessageCircleIcon,
  Tag,
  User,
} from "lucide-react";
import { useState } from "react";
import { TextAnnotation } from "../schema";
import { Checkbox } from "@radix-ui/react-checkbox";

export const HistoryFilter: React.FC<{
  visibleAnnotationTypes: TextAnnotation["type"][];
  setVisibleAnnotationTypes: (types: TextAnnotation["type"][]) => void;
}> = ({ visibleAnnotationTypes, setVisibleAnnotationTypes }) => {
  const [showFilterSettings, setShowFilterSettings] = useState(false);

  return (
    <div className="max-w-[400px] rounded border p-4 text-sm bg-gray-100">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            className="w-full flex-1 rounded-full border border-gray-300 bg-gray-200 px-1.5 py-1"
            placeholder="Search history..."
            type="search"
          />

          <button
            className={`flex-0 block grid h-7 w-7 place-items-center rounded-full text-white ${
              showFilterSettings ? "bg-blue-500" : "bg-black"
            }`}
            onClick={() => setShowFilterSettings(!showFilterSettings)}
          >
            <ListFilter className="block" size={16} strokeWidth={2} />
          </button>
        </div>

        {showFilterSettings && (
          <FilterSettings
            visibleAnnotationTypes={visibleAnnotationTypes}
            setVisibleAnnotationTypes={setVisibleAnnotationTypes}
          />
        )}
      </div>
    </div>
  );
};

function TypeIcon({ annotationType }: { annotationType: string }) {
  const symbol = annotationType[0].toUpperCase();

  const colorMap: Record<string, string> = {
    thread: "bg-yellow-500 border-yellow-600",
    change: "bg-green-500 border-green-600",
  };

  const colorClasses =
    colorMap[annotationType] || "bg-gray-500 border-grat-500"; // Default color if type is not found

  return (
    <div>
      <div
        className={`flex h-4 w-4 items-center justify-center rounded border ${colorClasses}`}
      >
        <span className="white font-medium text-white shadow-sm">{symbol}</span>
      </div>
    </div>
  );
}

const FilterSettings: React.FC<{
  visibleAnnotationTypes: TextAnnotation["type"][];
  setVisibleAnnotationTypes: (types: TextAnnotation["type"][]) => void;
}> = ({ visibleAnnotationTypes, setVisibleAnnotationTypes }) => {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-[10px] font-bold uppercase text-gray-500">
          Filters
        </h2>

        <div className="mb-2">
          {["thread", "patch", "draft"].map((annotationType) => {
            let label;

            switch (annotationType) {
              case "thread":
                label = "Comments";
                break;
              case "patch":
                label = "Edits";
                break;
              case "draft":
                label = "Edit Groups";
                break;
            }

            return (
              <div className="flex items-center">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={visibleAnnotationTypes.includes(
                      annotationType as TextAnnotation["type"]
                    )}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        setVisibleAnnotationTypes([
                          ...visibleAnnotationTypes,
                          annotationType as TextAnnotation["type"],
                        ]);
                      } else {
                        setVisibleAnnotationTypes(
                          visibleAnnotationTypes.filter(
                            (type) => type !== annotationType
                          )
                        );
                      }
                    }}
                  />
                  <TypeIcon annotationType={annotationType} />
                  <div>{label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function HistoryTrimmer() {
  const [range, setRange] = useState({ start: 0, end: 100 });

  const handleRangeChange = (value, type) => {
    setRange({ ...range, [type]: value });
  };

  return (
    <div className="flex space-x-2">
      <input
        type="range"
        min="0"
        max="100"
        value={range.start}
        onChange={(e) => handleRangeChange(e.target.value, "start")}
        className="w-full"
      />
      <input
        type="range"
        min="0"
        max="100"
        value={range.end}
        onChange={(e) => handleRangeChange(e.target.value, "end")}
        className="w-full"
      />
    </div>
  );
}

function randomHeight() {
  return Math.floor(Math.random() * (8 - 2 + 1)) + 2;
}
