// OpenCode server API types

export interface Project {
  id: string;
  path: string;
  name: string;
}

export interface Session {
  id: string;
  title?: string;
  parentID?: string;
  created: number;
  updated: number;
  share?: { url: string };
}

export interface SessionStatus {
  running: boolean;
  error?: string;
}

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    state: "call" | "result" | "partial-call";
    args?: Record<string, unknown>;
    result?: unknown;
  };
}

export interface StepStartPart {
  type: "step-start";
}

export interface ReasoningPart {
  type: "reasoning";
  reasoning: string;
}

export interface FileSnapshotPart {
  type: "file";
  mediaType: string;
  url: string;
}

export type Part =
  | TextPart
  | ToolInvocationPart
  | StepStartPart
  | ReasoningPart
  | FileSnapshotPart;

export interface Message {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  // Real server shape: timestamps live under time.*
  time: { created: number; completed?: number };
  // Legacy flat fields kept for compat
  created?: number;
  updated?: number;
  error?: { name: string; message: string; retries?: number };
  structured_output?: unknown;
  // Server returns model info as top-level providerID/modelID on assistant msgs
  // and as model: { providerID, modelID } on user msgs
  model?: { providerID: string; modelID: string };
  providerID?: string;
  modelID?: string;
  agent?: string;
  mode?: string;
  finish?: string;
  tokens?: { total?: number; input: number; output: number; reasoning: number };
  cost?: number;
}

export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export interface Provider {
  id: string;
  name: string;
  env?: string[];
  models: Model[];
}

export interface Model {
  id: string;
  name: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
}

export interface Config {
  model?: string;
  autoshare?: boolean;
  theme?: string;
  keybinds?: Record<string, string>;
}

export interface Agent {
  name: string;
  description?: string;
  model?: string;
  tools?: string[];
}

export interface Command {
  name: string;
  description?: string;
}

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface FileContent {
  type: "raw" | "patch";
  content: string;
  path?: string;
}

export interface FileStatus {
  path: string;
  status: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority?: "high" | "medium" | "low";
}

export interface FileDiff {
  path: string;
  diff: string;
  added: number;
  removed: number;
}

export interface LSPStatus {
  name: string;
  running: boolean;
  languages?: string[];
}

export interface FormatterStatus {
  name: string;
  running: boolean;
}

export interface MCPStatus {
  running: boolean;
  tools?: string[];
  error?: string;
}

export interface VcsInfo {
  branch?: string;
  dirty?: boolean;
  ahead?: number;
  behind?: number;
  remote?: string;
}

export interface PathInfo {
  cwd: string;
  root: string;
}

export interface HealthInfo {
  healthy: boolean;
  version: string;
}

export interface PermissionRequest {
  id: string;
  tool: string;
  description: string;
  command?: string;
}

export interface TextSearchMatch {
  path: string;
  lines: string;
  line_number: number;
  absolute_offset: number;
  submatches: Array<{ match: { text: string }; start: number; end: number }>;
}

export interface WorkspaceSymbol {
  name: string;
  kind: number;
  location: { path: string; range: { start: { line: number; character: number } } };
}

export interface ServerEvent {
  type: string;
  properties?: Record<string, unknown>;
}
