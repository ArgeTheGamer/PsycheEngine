export type Fact = {
  id: string;
  category: string;
  subject: string;
  attribute: string;
  value: string;
  unit: string;
  statement: string;
  source: string;
};

export type CanonVersion = {
  version: number;
  note: string;
  facts: Fact[];
  usage: Record<string, string[]>; // fact id -> section ids
};

export type DocumentInfo = {
  id: string;
  title: string;
};

export type Section = {
  id: string;
  doc: string;
  chapter: number;
  chapter_title: string;
  title: string;
  text: string;
  fact_ids: string[];
  attempts: number;
  unresolved_issues: unknown[];
};

export type Contradiction = {
  id: string;
  category: "limit" | "zone" | "role" | "step_order" | "reference";
  section_a: string;
  quote_a: string;
  section_b: string;
  quote_b: string;
  explanation: string;
};

export type AgentEvent = {
  ts: number;
  agent: string;
  model: string;
  section_id?: string;
  kind: "plan" | "draft" | "verdict" | "canon_update" | "rewrite";
  accepted?: boolean;
  message: string;
  quote?: string;
};

export type CallRecord = {
  agent: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  tags?: { doc?: string; chapter?: number };
};

export type ChangeNotice = {
  audience: "client" | "staff";
  subject: string;
  body: string;
  cited_section_ids: string[];
  cited_fact_ids: string[];
  attempts: number;
  unresolved_issues: unknown[];
};

export type FactChangeRecord = {
  change: {
    fact_id: string;
    old_value: string;
    new_value: string;
    affected_sections: string[];
  };
  diff: { section_id: string; title: string; before: string; after: string }[];
  events: AgentEvent[];
  notices?: ChangeNotice[];
};

export type DerivedChange = {
  fact_id: string;
  old_value: string;
  new_value: string;
};

export type StaleHit = {
  fact_id: string;
  old: string;
  section_id: string;
  match: string;
};

export type MutationResult = {
  sections_changed: number;
  chars_changed: number;
  cost_usd: number;
  stale: StaleHit[];
  unknown_ids?: string[];
};

export type MutationStep = {
  step: number;
  fact: string;
  notice: string;
  derived: DerivedChange[];
  engine: MutationResult;
  baseline: MutationResult;
};

export type AuditViolation = {
  category: string;
  fact_id: string;
  quote: string;
  explanation: string;
  section_id: string;
};

export type AuditContradiction = {
  category: string;
  section_a: string;
  quote_a: string;
  section_b: string;
  quote_b: string;
  explanation: string;
};

export type MutationAudit = {
  label: string;
  contradictions: AuditContradiction[];
  violations: AuditViolation[];
  discarded: number;
  within: Record<string, number>;
  between: Record<string, number>;
  violations_per_doc: Record<string, number>;
};

export type MutationsFile = {
  baseline_variant: string;
  steps: MutationStep[];
  final_audit: { engine: MutationAudit; baseline: MutationAudit };
};

export type RunInfo = {
  id: string;
  label: string;
  company: string;
  created: string;
};

export type RunsFile = { runs: RunInfo[] };

export type RunId = "psyche" | "baseline";
