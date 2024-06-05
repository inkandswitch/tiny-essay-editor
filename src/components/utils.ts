import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useReducer } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
