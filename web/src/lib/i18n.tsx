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
  "n.sections.one": { en: "section", pl: "sekcja" },
  "n.sections.few": { en: "sections", pl: "sekcje" },
  "n.sections.many": { en: "sections", pl: "sekcji" },
  "n.documents.one": { en: "document", pl: "dokument" },
  "n.documents.few": { en: "documents", pl: "dokumenty" },
  "n.documents.many": { en: "documents", pl: "dokumentów" },
  "n.months.one": { en: "month", pl: "miesiąc" },
  "n.months.few": { en: "months", pl: "miesiące" },
  "n.months.many": { en: "months", pl: "miesięcy" },
  "n.sections_rewritten.one": { en: "section rewritten", pl: "przepisana sekcja" },
  "n.sections_rewritten.few": { en: "sections rewritten", pl: "przepisane sekcje" },
  "n.sections_rewritten.many": { en: "sections rewritten", pl: "przepisanych sekcji" },
  "n.rejections_caught.one": { en: "rejection caught by the critic", pl: "odrzucenie wyłapane przez krytyka" },
  "n.rejections_caught.few": { en: "rejections caught by the critic", pl: "odrzucenia wyłapane przez krytyka" },
  "n.rejections_caught.many": { en: "rejections caught by the critic", pl: "odrzuceń wyłapanych przez krytyka" },
  "n.contradictions_between.one": { en: "contradiction between documents", pl: "sprzeczność między dokumentami" },
  "n.contradictions_between.few": { en: "contradictions between documents", pl: "sprzeczności między dokumentami" },
  "n.contradictions_between.many": { en: "contradictions between documents", pl: "sprzeczności między dokumentami" },
  "yo.title": { en: "A year of changes", pl: "Rok zmian" },
  "yo.play": { en: "Play", pl: "Odtwórz" },
  "yo.pause": { en: "Pause", pl: "Wstrzymaj" },
  "yo.replay": { en: "Replay", pl: "Powtórz" },
  "yo.exit": { en: "Exit", pl: "Zamknij" },
  "yo.press_play": { en: "Press play to run the year", pl: "Naciśnij odtwarzanie, aby uruchomić rok" },
  "yo.month": { en: "Month", pl: "Miesiąc" },
  "yo.of": { en: "of", pl: "z" },
  "yo.paused_hint": {
    en: "Paused — pick a month to inspect its stale values",
    pl: "Wstrzymano — wybierz miesiąc, aby sprawdzić nieaktualne wartości",
  },
  "yo.not_started": { en: "The year has not started yet — press play.", pl: "Rok jeszcze się nie zaczął — naciśnij odtwarzanie." },
  "yo.left_behind": { en: "stale values the baselines left behind", pl: "nieaktualne wartości pozostawione przez baselines" },
  "yo.none": { en: "None this month.", pl: "Brak w tym miesiącu." },
  "yo.cost": { en: "cost", pl: "koszt" },
  "play.replaying": { en: "Replaying", pl: "Odtwarzanie" },
  "play.queued": { en: "queued", pl: "w kolejce" },
  "play.writing": { en: "writing", pl: "pisanie" },
  "play.rejected": { en: "rejected", pl: "odrzucone" },
  "play.accepted": { en: "accepted", pl: "zaakceptowane" },
  "play.sections_accepted": { en: "Sections accepted", pl: "Zaakceptowane sekcje" },
  "play.rejections": { en: "Critic rejections", pl: "Odrzucenia krytyka" },
  "play.canon_facts": { en: "Canon facts", pl: "Fakty kanonu" },
  "play.cost_so_far": { en: "Cost so far", pl: "Koszt do tej pory" },
  "play.generation": { en: "of generation", pl: "generowania" },
  "play.hint": {
    en: "Space pauses · ←/→ change speed · Esc exits",
    pl: "Spacja wstrzymuje · ←/→ zmieniają prędkość · Esc zamyka",
  },
  "play.waiting": { en: "Waiting for the first draft…", pl: "Oczekiwanie na pierwszy szkic…" },
  "play.critic_rejected": { en: "critic rejected", pl: "krytyk odrzucił" },
  "play.complete": { en: "Run complete", pl: "Przebieg zakończony" },
  "play.chapter": { en: "Ch", pl: "Rozdz." },
  "cat.responsibility": { en: "responsibility", pl: "odpowiedzialność" },
  "cat.procedure": { en: "procedure", pl: "procedura" },
  "cat.equipment": { en: "equipment", pl: "sprzęt" },
  "cat.schedule": { en: "schedule", pl: "harmonogram" },
  "graph.version": { en: "Canon version", pl: "Wersja kanonu" },
  "graph.search": { en: "Search facts…", pl: "Szukaj faktów…" },
  "graph.col_fact": { en: "Fact", pl: "Fakt" },
  "graph.col_subject": { en: "Subject.attribute", pl: "Podmiot.atrybut" },
  "graph.col_value": { en: "Value", pl: "Wartość" },
  "graph.used_in": { en: "Used in", pl: "Użyty w" },
  "graph.no_match": { en: "No facts match", pl: "Żaden fakt nie pasuje do" },
  "graph.no_versions": { en: "No canon versions in this run.", pl: "Ten przebieg nie ma wersji kanonu." },
  "graph.replay": { en: "Replay change", pl: "Odtwórz zmianę" },
  "graph.not_referenced": { en: "Not referenced by any section yet.", pl: "Żadna sekcja jeszcze się nie odwołuje." },
  "graph.subject": { en: "Subject", pl: "Podmiot" },
  "graph.attribute": { en: "Attribute", pl: "Atrybut" },
  "graph.source": { en: "Source", pl: "Źródło" },
  "graph.close": { en: "Close", pl: "Zamknij" },
  "graph.select": {
    en: "Select a fact to read its statement and see every section that uses it.",
    pl: "Wybierz fakt, aby przeczytać jego treść i zobaczyć wszystkie sekcje, które go używają.",
  },
  "n.facts.one": { en: "fact", pl: "fakt" },
  "n.facts.few": { en: "facts", pl: "fakty" },
  "n.facts.many": { en: "facts", pl: "faktów" },
  "n.documents_loc.one": { en: "document", pl: "dokumencie" },
  "n.documents_loc.few": { en: "documents", pl: "dokumentach" },
  "n.documents_loc.many": { en: "documents", pl: "dokumentach" },
  "n.issues.one": { en: "issue", pl: "problem" },
  "n.issues.few": { en: "issues", pl: "problemy" },
  "n.issues.many": { en: "issues", pl: "problemów" },
  "replay.step_deps": { en: "Dependencies", pl: "Zależności" },
  "replay.step_log": { en: "Rewrite log", pl: "Dziennik przepisywania" },
  "replay.step_diff": { en: "Before / after", pl: "Przed / po" },
  "replay.step_notices": { en: "Notices", pl: "Zawiadomienia" },
  "replay.step": { en: "Step", pl: "Krok" },
  "replay.back": { en: "Back", pl: "Wstecz" },
  "replay.next": { en: "Next", pl: "Dalej" },
  "replay.hint": { en: "← → to step, Esc to close", pl: "← → zmienia kroki, Esc zamyka" },
  "replay.close": { en: "Close replay", pl: "Zamknij odtwarzanie" },
  "replay.for_clients": { en: "For clients", pl: "Dla klientów" },
  "replay.for_staff": { en: "For staff", pl: "Dla personelu" },
  "replay.checked": { en: "checked by critic", pl: "sprawdzone przez krytyka" },
  "replay.no_rewrite": { en: "No sections were rewritten.", pl: "Żadna sekcja nie została przepisana." },
  "replay.before": { en: "Before", pl: "Przed" },
  "replay.after": { en: "After", pl: "Po" },
  "replay.in": { en: "in", pl: "w" },
  "replay.depend_on": { en: "depend on", pl: "zależy od" },
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
