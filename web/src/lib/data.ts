import type {
  AgentEvent,
  CallRecord,
  CanonVersion,
  Contradiction,
  FactChangeRecord,
  RunId,
  RunsFile,
  Section,
} from "./types";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getOptionalJSON<T>(path: string): Promise<T | null> {
  const res = await fetch(path);
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as T;
}

export function loadRuns(): Promise<RunsFile> {
  return getJSON<RunsFile>("/runs/runs.json");
}

export function loadCanon(runId: string): Promise<CanonVersion[]> {
  return getJSON<CanonVersion[]>(`/runs/${runId}/canon.json`);
}

export function loadSections(runId: string, which: RunId): Promise<Section[]> {
  return getJSON<Section[]>(`/runs/${runId}/sections_${which}.json`);
}

export async function loadContradictions(
  runId: string,
  which: RunId,
): Promise<Contradiction[]> {
  const data = await getOptionalJSON<Contradiction[]>(
    `/runs/${runId}/contradictions_${which}.json`,
  );
  return data ?? [];
}

export function loadEvents(runId: string): Promise<AgentEvent[]> {
  return getJSON<AgentEvent[]>(`/runs/${runId}/events.json`);
}

export async function loadCalls(
  runId: string,
  which: RunId,
): Promise<CallRecord[]> {
  const data = await getOptionalJSON<CallRecord[]>(
    `/runs/${runId}/calls_${which}.json`,
  );
  return data ?? [];
}

export async function loadChanges(
  runId: string,
): Promise<FactChangeRecord[]> {
  const data = await getOptionalJSON<FactChangeRecord[]>(
    `/runs/${runId}/changes.json`,
  );
  return data ?? [];
}

export type RunData = {
  canon: CanonVersion[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  events: AgentEvent[];
  callsPsyche: CallRecord[];
  callsBaseline: CallRecord[];
  changes: FactChangeRecord[];
};

export async function loadRun(runId: string): Promise<RunData> {
  const [
    canon,
    sectionsPsyche,
    sectionsBaseline,
    contradictionsPsyche,
    contradictionsBaseline,
    events,
    callsPsyche,
    callsBaseline,
    changes,
  ] = await Promise.all([
    loadCanon(runId),
    loadSections(runId, "psyche"),
    loadSections(runId, "baseline"),
    loadContradictions(runId, "psyche"),
    loadContradictions(runId, "baseline"),
    loadEvents(runId),
    loadCalls(runId, "psyche"),
    loadCalls(runId, "baseline"),
    loadChanges(runId),
  ]);
  return {
    canon,
    sectionsPsyche,
    sectionsBaseline,
    contradictionsPsyche,
    contradictionsBaseline,
    events,
    callsPsyche,
    callsBaseline,
    changes,
  };
}
