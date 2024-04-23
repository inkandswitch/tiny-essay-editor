/// <reference types="navigation-api-types" />

import { useEffect, useState } from "react";

export const useCurrentUrlPath = (): string => {
  // Initialize the state with the current location
  const [urlPath, setUrlPath] = useState(window.location.pathname);

  useEffect(() => {
    const onNavigate = (event: NavigateEvent) => {
      if (shouldNotIntercept(event)) {
        return;
      }

      console.log(event);

      event.intercept({
        handler: async () => {
          console.log("intercept", window.location.pathname);

          setUrlPath(window.location.pathname);
        },
      });
    };

    navigation.addEventListener("navigate", onNavigate);

    // Clean up the event listener when the component unmounts
    return () => {
      navigation.removeEventListener("navigate", onNavigate);
    };
  }, []);

  return urlPath;
};

export const useCurrentUrlHash = (): string => {
  const [hash, setHash] = useState(location.hash);

  useEffect(() => {
    const hashChangeHandler = () => {
      setHash(location.hash);
    };

    // Listen for hash changes
    window.addEventListener("hashchange", hashChangeHandler, false);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("hashchange", hashChangeHandler, false);
    };
  }, []);

  return hash;
};

export const useActiveDocument = () => {};

const shouldNotIntercept = (navigationEvent) => {
  return (
    !navigationEvent.canIntercept ||
    // If this is just a hashChange,
    // just let the browser handle scrolling to the content.
    navigationEvent.hashChange ||
    // If this is a download,
    // let the browser perform the download.
    navigationEvent.downloadRequest ||
    // If this is a form submission,
    // let that go to the server.
    navigationEvent.formData ||
    // Ignore replace eve
    navigationEvent.navigationType === "replace"
  );
};

// use replaceUrl to change the current url without triggering a navigation event
// and without adding a new entry to the history
export const replaceUrl = (url: string) => {
  history.replaceState({ ignore: false }, "", url);
};
