import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useReducer } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useForceUpdate() {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  return forceUpdate;
}
