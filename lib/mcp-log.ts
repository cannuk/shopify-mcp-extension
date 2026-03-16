export interface McpLogEntry {
  id: number;
  timestamp: Date;
  method: string;
  params: Record<string, unknown>;
  response: unknown | null;
  error: string | null;
  durationMs: number;
}

type LogListener = (entry: McpLogEntry) => void;

const MAX_ENTRIES = 200;
let nextId = 1;
const entries: McpLogEntry[] = [];
const listeners: LogListener[] = [];

export const mcpLog = {
  entries,

  addEntry(entry: Omit<McpLogEntry, "id">): McpLogEntry {
    const full = { ...entry, id: nextId++ };
    entries.unshift(full);
    if (entries.length > MAX_ENTRIES) entries.pop();
    listeners.forEach((fn) => fn(full));
    return full;
  },

  onEntry(callback: LogListener): void {
    listeners.push(callback);
  },

  clear(): void {
    entries.length = 0;
  },
};
