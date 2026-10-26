import type {
  AgentEvent,
  CallRecord,
  CanonVersion,
  Contradiction,
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

export function loadRuns(): Promise<RunsFile> {
  return getJSON<RunsFile>("/runs/runs.json");
}

export function loadCanon(runId: string): Promise<CanonVersion[]> {
  return getJSON<CanonVersion[]>(`/runs/${runId}/canon.json`);
}

export function loadSections(runId: string, which: RunId): Promise<Section[]> {
  return getJSON<Section[]>(`/runs/${runId}/sections_${which}.json`);
}

export function loadContradictions(
  runId: string,
  which: RunId,
): Promise<Contradiction[]> {
  return getJSON<Contradiction[]>(
    `/runs/${runId}/contradictions_${which}.json`,
  );
}

export function loadEvents(runId: string): Promise<AgentEvent[]> {
  return getJSON<AgentEvent[]>(`/runs/${runId}/events.json`);
}

export function loadCalls(
  runId: string,
  which: RunId,
): Promise<CallRecord[]> {
  return getJSON<CallRecord[]>(`/runs/${runId}/calls_${which}.json`);
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
  ] = await Promise.all([
    loadCanon(runId),
    loadSections(runId, "psyche"),
    loadSections(runId, "baseline"),
    loadContradictions(runId, "psyche"),
    loadContradictions(runId, "baseline"),
    loadEvents(runId),
    loadCalls(runId, "psyche"),
    loadCalls(runId, "baseline"),
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
  };
}
