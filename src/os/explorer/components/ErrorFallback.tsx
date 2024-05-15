import React from "react";

export const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div className="w-full h-full flex items-center justify-center text-sm text-red-600">
      Something went wrong: {error.message}
    </div>
  );
};
