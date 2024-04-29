/// <reference types="navigation-api-types" />

import { useEffect, useState } from "react";

export const useCurrentUrlPath = (): string => {
  // Initialize the state with the current location
  const [location, setLocation] = useState(window.location.pathname);

  useEffect(() => {
    const onNavigate = (event: NavigateEvent) => {
      if (shouldNotIntercept(event)) {
        return;
      }

      event.intercept({
        handler: async () => {
          setLocation(window.location.pathname);
        },
      });
    };

    navigation.addEventListener("navigate", onNavigate);

    // Clean up the event listener when the component unmounts
    return () => {
      navigation.removeEventListener("navigate", onNavigate);
    };
  }, []);

  return location;
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
    navigationEvent.formData
  );
};
