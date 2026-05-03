import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  // clsx resolves conditional class fragments; twMerge then enforces Tailwind conflict precedence.
  return twMerge(clsx(inputs))
}

