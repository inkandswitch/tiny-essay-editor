/// <reference types="navigation-api-types" />

import { useEffect, useState } from "react";

export const useCurrentUrl = (): URL => {
  // Initialize the state with the current location
  const [url, setUrl] = useState<URL>(() => new URL(location.href));

  console.log();

  useEffect(() => {
    const onNavigate = (event: NavigateEvent) => {
      setUrl(new URL(event.destination.url));

      if (shouldNotIntercept(event)) {
        return;
      }

      event.intercept();
    };

    navigation.addEventListener("navigate", onNavigate);

    // Clean up the event listener when the component unmounts
    return () => {
      navigation.removeEventListener("navigate", onNavigate);
    };
  }, []);

  return url;
};

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
