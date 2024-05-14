import { useEffect, useState } from "react";

export const useCurrentUrl = () => {
  const [url, setUrl] = useState<URL>(getCurrentHashUrl());

  useEffect(() => {
    const onHashChange = () => setUrl(getCurrentHashUrl());

    // Listen for hash changes
    window.addEventListener("hashchange", onHashChange);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return url;
};

const getCurrentHashUrl = (): URL => {
  return new URL(`${location.origin}/${location.hash.slice(1)}`);
};

export const replaceUrl = (url: string) => {
  history.replaceState(null, "", `/#${url}`);
};
