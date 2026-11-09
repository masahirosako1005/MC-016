import { useEffect, useState } from "react";

export type FontSize = 1 | 2 | 3;
export type Theme = "standard" | "contrast";
export type Prefs = { fontSize: FontSize; theme: Theme; easy: boolean };

const KEY = "hitomeguri.prefs";
const DEFAULT: Prefs = { fontSize: 2, theme: "standard", easy: false };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const j = JSON.parse(raw);
    return { ...DEFAULT, ...j };
  } catch {
    return DEFAULT;
  }
}

let current: Prefs = load();
const subs = new Set<(p: Prefs) => void>();

export function getPrefs(): Prefs {
  return current;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* 保存できなくても動く */
  }
  apply(current);
  subs.forEach((s) => s(current));
}

export function apply(p: Prefs) {
  const root = document.documentElement;
  root.dataset.font = String(p.fontSize);
  root.dataset.theme = p.theme;
  root.dataset.easy = p.easy ? "1" : "0";
}

export function usePrefs(): Prefs {
  const [p, setP] = useState(current);
  useEffect(() => {
    subs.add(setP);
    return () => {
      subs.delete(setP);
    };
  }, []);
  return p;
}

apply(current);
