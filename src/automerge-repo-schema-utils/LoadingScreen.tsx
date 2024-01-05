import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

// A very rough and naive loading screen.
// It just assumes things load in ~1 second and shows a progress bar.

// Typically Automerge blocks the UI thread while it's loading though,
// so we don't get smooth progress or anything, the bar just
// shows empty and then the doc loads.

// TODO: use a GPU transform to get smooth loading while process blocked
// TODO: get more actual progress metadata out of automerge to drive the bar

export const LoadingScreen = ({
  docUrl,
  handle,
}: {
  docUrl: AutomergeUrl | null;
  handle: DocHandle<any> | null;
}) => {
  const [loadProgress, setLoadProgress] = useState(0);
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setLoadProgress((prevProgress) => Math.min(prevProgress + 10, 100));
    }, 100);

    return () => {
      clearInterval(progressInterval);
    };
  });

  return (
    <div className="h-screen w-full bg-gray-100 flex items-center justify-center">
      <div>
        <div className="text-sm mb-4 font-light">
          {docUrl && handle && `Loading ${docUrl}: ${handle.state}...`}
          {!docUrl || (!handle && `Loading...`)}
        </div>
        <Progress
          color="blue"
          value={loadProgress}
          className="w-96 border bg-gray-50 h-2"
        />
      </div>
    </div>
  );
};
