export interface HistoryEntry {
  date: string;
  tool: string;
  summary: string;
  todo: string;
  decision: string;
}

export interface ProjectContext {
  project: string;
  last_updated: string;
  current_status: string;
  key_decisions: string[];
  history: HistoryEntry[];
  filePath: string;
}

export interface ProjectSummary {
  name: string;
  filePath: string;
  project: string;
  last_updated: string;
  current_status: string;
  history_count: number;
}
