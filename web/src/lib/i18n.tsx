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
  "ver.psyche": { en: "PsycheEngine", pl: "PsycheEngine" },
  "ver.baseline": { en: "Baseline", pl: "Baseline" },
  "ver.baseline_ctx": { en: "Baseline · one context", pl: "Baseline · jeden kontekst" },
  "ver.baseline_perdoc": { en: "Baseline · each document separately", pl: "Baseline · każdy dokument osobno" },
  "bench.total": { en: "in total", pl: "łącznie" },
  "bench.of_which": { en: "of which", pl: "w tym" },
  "bench.details": { en: "Details", pl: "Szczegóły" },
  "bench.bars": { en: "Contradictions by kind", pl: "Sprzeczności według rodzaju" },
  "bench.matrix": { en: "Between which documents", pl: "Między którymi dokumentami" },
  "bench.violations": { en: "Fact violations", pl: "Naruszenia faktów" },
  "n.contradictions.one": { en: "contradiction", pl: "sprzeczność" },
  "n.contradictions.few": { en: "contradictions", pl: "sprzeczności" },
  "n.contradictions.many": { en: "contradictions", pl: "sprzeczności" },
  "n.violations.one": { en: "fact violation", pl: "naruszenie faktu" },
  "n.violations.few": { en: "fact violations", pl: "naruszenia faktów" },
  "n.violations.many": { en: "fact violations", pl: "naruszeń faktów" },
  "usage.totals": { en: "Totals", pl: "Łącznie" },
  "usage.cost": { en: "Cost", pl: "Koszt" },
  "usage.tokens": { en: "Tokens", pl: "Tokeny" },
  "usage.per_doc": { en: "Cost and tokens per document", pl: "Koszt i tokeny na dokument" },
  "usage.per_agent": { en: "Cost and tokens per agent", pl: "Koszt i tokeny na agenta" },
  "usage.document": { en: "Document", pl: "Dokument" },
  "usage.agent": { en: "Agent", pl: "Agent" },
  "usage.total": { en: "Total", pl: "Razem" },
  "usage.not_tagged": { en: "not tagged", pl: "bez etykiety" },
  "usage.untagged": {
    en: "Planning and audit calls carry no document tag; they count towards the totals only.",
    pl: "Wywołania planowania i audytu nie mają etykiety dokumentu; liczą się tylko do sum.",
  },
  "usage.chart": { en: "Cost per document", pl: "Koszt na dokument" },
  "year.step": { en: "Step", pl: "Krok" },
  "year.change": { en: "Change", pl: "Zmiana" },
  "year.knockon": { en: "Knock-on · computed in code", pl: "Zmiany kaskadowe · policzone w kodzie" },
  "year.stale_chart": { en: "Stale values left in the documents", pl: "Nieaktualne wartości w dokumentach" },
  "year.rewrite_chart": { en: "Sections rewritten per change", pl: "Przepisane sekcje na zmianę" },
  "year.still_wrong": { en: "Still wrong after", pl: "Wciąż błędne po" },
  "year.clean_sub": {
    en: "Every change was applied everywhere it was needed.",
    pl: "Każda zmiana została zastosowana wszędzie, gdzie trzeba.",
  },
  "year.still_says": { en: "still says", pl: "wciąż" },
  "year.not_in_canon": { en: "not in canon", pl: "brak w kanonie" },
  "year.unknown_fact": { en: "unknown fact", pl: "nieznany fakt" },
  "year.audit_violation": { en: "audit violation", pl: "naruszenie audytu" },
  "year.vs": { en: "vs", pl: "kontra" },
  "n.facts_changed.one": { en: "fact changed", pl: "zmieniony fakt" },
  "n.facts_changed.few": { en: "facts changed", pl: "zmienione fakty" },
  "n.facts_changed.many": { en: "facts changed", pl: "zmienionych faktów" },
  "n.changes.one": { en: "change", pl: "zmiana" },
  "n.changes.few": { en: "changes", pl: "zmiany" },
  "n.changes.many": { en: "changes", pl: "zmian" },
  "n.stale.one": { en: "stale value", pl: "nieaktualna wartość" },
  "n.stale.few": { en: "stale values", pl: "nieaktualne wartości" },
  "n.stale.many": { en: "stale values", pl: "nieaktualnych wartości" },
} as const;

export type StringKey = keyof typeof STRINGS;

/** "one" | "few" | "many" for count-prefixed nouns ("3 sections"). English never uses "few". */
export function pluralForm(lang: Lang, n: number): "one" | "few" | "many" {
  if (lang === "pl") {
    if (n === 1) return "one";
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "few";
    return "many";
  }
  return n === 1 ? "one" : "many";
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey) => string;
  /** t() for a counted noun: keys `${base}.one` / `.few` / `.many` must exist. */
  tn: (base: string, n: number) => string;
};
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
  const tn = useCallback(
    (base: string, n: number) => STRINGS[`${base}.${pluralForm(lang, n)}` as StringKey][lang],
    [lang],
  );
  return <LangContext.Provider value={{ lang, setLang, t, tn }}>{children}</LangContext.Provider>;
}

export function useT(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used inside LangProvider");
  return ctx;
}
