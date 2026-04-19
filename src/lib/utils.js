// src/lib/utils.js — Utility function for merging Tailwind class names (shadcn/ui)
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
