import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

export const LoadingScreen = ({
  docUrl,
  handle,
}: {
  docUrl: AutomergeUrl;
  handle: DocHandle<any>;
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
    <div className="h-screen w-screen bg-gray-100 flex items-center justify-center">
      <div>
        <div className="text-sm mb-4 font-light">
          {`Loading ${docUrl}: ${handle.state}...`}
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
