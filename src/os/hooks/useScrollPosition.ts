import { useEffect, useState } from "react";

export const useScrollPosition = (container: HTMLElement | null) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (!container) {
      return;
    }
    const updatePosition = () => {
      setScrollPosition(container.scrollTop);
    };
    container.addEventListener("scroll", () => updatePosition());
    updatePosition();
    return () => container.removeEventListener("scroll", updatePosition);
  }, [container]);

  return scrollPosition;
};
