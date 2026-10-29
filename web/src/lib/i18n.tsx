"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "pl";

// UI strings only. Document text, quotes and agent messages stay in the language they were written in.
const STRINGS = {
  "app.tagline": { en: "One canon of facts, four documents that agree", pl: "Jeden kanon faktów, cztery zgodne dokumenty" },
  "nav.production": { en: "Production", pl: "Produkcja" },
  "nav.benchmark": { en: "Benchmark", pl: "Benchmark" },
  "nav.year": { en: "Year", pl: "Rok" },
  "nav.graph": { en: "Graph", pl: "Graf" },
  "nav.logs": { en: "Logs", pl: "Logi" },
  "nav.usage": { en: "Usage", pl: "Zużycie" },
  "nav.production.hint": { en: "Documents and contradictions", pl: "Dokumenty i sprzeczności" },
  "nav.benchmark.hint": { en: "PsycheEngine vs baseline", pl: "PsycheEngine kontra baseline" },
  "nav.year.hint": { en: "Twelve changes, month by month", pl: "Dwanaście zmian, miesiąc po miesiącu" },
  "nav.graph.hint": { en: "Canon and what depends on it", pl: "Kanon i to, co od niego zależy" },
  "nav.logs.hint": { en: "What each agent did", pl: "Co zrobił każdy agent" },
  "nav.usage.hint": { en: "Tokens and cost", pl: "Tokeny i koszt" },
  "top.run": { en: "Run", pl: "Przebieg" },
  "top.play": { en: "Play run", pl: "Odtwórz przebieg" },
  "top.year": { en: "Year overview", pl: "Przegląd roku" },
  "top.lang": { en: "Interface language", pl: "Język interfejsu" },
  "state.loading": { en: "Loading run data…", pl: "Wczytywanie danych przebiegu…" },
  "state.error": { en: "Run data could not be loaded:", pl: "Nie udało się wczytać danych przebiegu:" },
  "prod.documents": { en: "Documents", pl: "Dokumenty" },
  "prod.sections": { en: "sections", pl: "sekcji" },
  "prod.engine": { en: "PsycheEngine", pl: "PsycheEngine" },
  "prod.baseline": { en: "Baseline · each document on its own", pl: "Baseline · każdy dokument osobno" },
  "prod.rewritten": { en: "rewritten after the critic", pl: "przepisana po uwagach krytyka" },
  "prod.no_text": { en: "This version has no text for the section.", pl: "Ta wersja nie ma tekstu dla tej sekcji." },
  "prod.issues": { en: "Contradictions", pl: "Sprzeczności" },
  "prod.issues.doc": { en: "involving this document", pl: "dotyczące tego dokumentu" },
  "prod.between": { en: "between documents", pl: "między dokumentami" },
  "prod.within": { en: "within a document", pl: "w obrębie dokumentu" },
  "prod.none": { en: "None found by the auditor.", pl: "Audytor nie znalazł żadnych." },
  "prod.open": { en: "Open", pl: "Otwórz" },
  "prod.conflicts_with": { en: "conflicts with", pl: "sprzeczne z" },
  "prod.here": { en: "this section", pl: "ta sekcja" },
  "cat.limit": { en: "limit", pl: "limit" },
  "cat.zone": { en: "zone", pl: "strefa" },
  "cat.role": { en: "role", pl: "rola" },
  "cat.step_order": { en: "step order", pl: "kolejność kroków" },
  "cat.reference": { en: "reference", pl: "odwołanie" },
} as const;

export type StringKey = keyof typeof STRINGS;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: StringKey) => string };
const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pe-lang");
      if (saved === "en" || saved === "pl") setLangState(saved);
    } catch {
      /* storage blocked: stay on English */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("pe-lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((key: StringKey) => STRINGS[key][lang], [lang]);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used inside LangProvider");
  return ctx;
}
