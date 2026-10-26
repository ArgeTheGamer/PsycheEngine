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

export type Section = {
  id: string;
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
  tags?: { chapter?: number };
};

export type RunInfo = {
  id: string;
  label: string;
  company: string;
  created: string;
};

export type RunsFile = { runs: RunInfo[] };

export type RunId = "psyche" | "baseline";
