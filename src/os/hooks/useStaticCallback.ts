import { useCallback, useRef } from "react";

export const useStaticCallback = <Params extends any[], Result>(
  callback: (...args: Params) => Result
): ((...args: Params) => Result) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback((...args: Params) => callbackRef.current(...args), []);
};
