import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Agent,
  Command,
  Config,
  FileContent,
  FileNode,
  FileStatus,
  FileDiff,
  FormatterStatus,
  HealthInfo,
  LSPStatus,
  MCPStatus,
  Message,
  MessageWithParts,
  Model,
  PathInfo,
  PermissionRequest,
  Project,
  Provider,
  Session,
  SessionStatus,
  TextSearchMatch,
  Todo,
  VcsInfo,
  WorkspaceSymbol,
} from "../types/opencode";

export const SERVER_URL_KEY = "opencode_server_url";
export const SERVER_AUTH_KEY = "opencode_server_auth";

export class OpencodeClient {
  private baseUrl: string;
  private authHeader?: string;

  constructor(baseUrl: string, auth?: { username: string; password: string }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (auth) {
      const encoded = btoa(`${auth.username}:${auth.password}`);
      this.authHeader = `Basic ${encoded}`;
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authHeader) h["Authorization"] = this.authHeader;
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined) params.set(k, v);
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const text = await res.text();
    if (!text) return true as unknown as T;
    return JSON.parse(text) as T;
  }

  // ─── Global ─────────────────────────────────────────────────────────────────

  async health(): Promise<HealthInfo> {
    return this.request("GET", "/global/health");
  }

  // ─── Project ─────────────────────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    return this.request("GET", "/project");
  }

  async currentProject(): Promise<Project> {
    return this.request("GET", "/project/current");
  }

  // ─── Path & VCS ─────────────────────────────────────────────────────────────

  async getPath(): Promise<PathInfo> {
    return this.request("GET", "/path");
  }

  async getVcs(): Promise<VcsInfo> {
    return this.request("GET", "/vcs");
  }

  // ─── Config ──────────────────────────────────────────────────────────────────

  async getConfig(): Promise<Config> {
    return this.request("GET", "/config");
  }

  async updateConfig(config: Partial<Config>): Promise<Config> {
    return this.request("PATCH", "/config", config);
  }

  async getProviders(): Promise<{ providers: Provider[]; default: Record<string, string> }> {
    return this.request("GET", "/config/providers");
  }

  // ─── Provider ────────────────────────────────────────────────────────────────

  async getAllProviders(): Promise<{
    all: Provider[];
    default: Record<string, string>;
    connected: string[];
  }> {
    return this.request("GET", "/provider");
  }

  async getProviderAuth(): Promise<Record<string, unknown[]>> {
    return this.request("GET", "/provider/auth");
  }

  async setAuth(
    providerId: string,
    credentials: Record<string, unknown>
  ): Promise<boolean> {
    return this.request("PUT", `/auth/${providerId}`, credentials);
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  async listSessions(): Promise<Session[]> {
    return this.request("GET", "/session");
  }

  async getSession(id: string): Promise<Session> {
    return this.request("GET", `/session/${id}`);
  }

  async createSession(opts?: { title?: string; parentID?: string }): Promise<Session> {
    return this.request("POST", "/session", opts ?? {});
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.request("DELETE", `/session/${id}`);
  }

  async updateSession(id: string, updates: { title?: string }): Promise<Session> {
    return this.request("PATCH", `/session/${id}`, updates);
  }

  async getSessionStatus(): Promise<Record<string, SessionStatus>> {
    return this.request("GET", "/session/status");
  }

  async getSessionChildren(id: string): Promise<Session[]> {
    return this.request("GET", `/session/${id}/children`);
  }

  async getSessionTodos(id: string): Promise<Todo[]> {
    return this.request("GET", `/session/${id}/todo`);
  }

  async abortSession(id: string): Promise<boolean> {
    return this.request("POST", `/session/${id}/abort`);
  }

  async shareSession(id: string): Promise<Session> {
    return this.request("POST", `/session/${id}/share`);
  }

  async unshareSession(id: string): Promise<Session> {
    return this.request("DELETE", `/session/${id}/share`);
  }

  async forkSession(id: string, messageID?: string): Promise<Session> {
    return this.request("POST", `/session/${id}/fork`, { messageID });
  }

  async initSession(
    id: string,
    opts: { messageID: string; providerID: string; modelID: string }
  ): Promise<boolean> {
    return this.request("POST", `/session/${id}/init`, opts);
  }

  async summarizeSession(
    id: string,
    opts: { providerID: string; modelID: string }
  ): Promise<boolean> {
    return this.request("POST", `/session/${id}/summarize`, opts);
  }

  async revertMessage(
    sessionId: string,
    opts: { messageID: string; partID?: string }
  ): Promise<boolean> {
    return this.request("POST", `/session/${sessionId}/revert`, opts);
  }

  async unrevertMessages(sessionId: string): Promise<boolean> {
    return this.request("POST", `/session/${sessionId}/unrevert`);
  }

  async getSessionDiff(sessionId: string, messageID?: string): Promise<FileDiff[]> {
    return this.request(
      "GET",
      `/session/${sessionId}/diff`,
      undefined,
      messageID ? { messageID } : undefined
    );
  }

  async respondToPermission(
    sessionId: string,
    permissionID: string,
    response: "allow" | "deny",
    remember?: boolean
  ): Promise<boolean> {
    return this.request(
      "POST",
      `/session/${sessionId}/permissions/${permissionID}`,
      { response, remember }
    );
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async listMessages(sessionId: string, limit?: number): Promise<MessageWithParts[]> {
    return this.request(
      "GET",
      `/session/${sessionId}/message`,
      undefined,
      limit ? { limit: String(limit) } : undefined
    );
  }

  async getMessage(sessionId: string, messageId: string): Promise<MessageWithParts> {
    return this.request("GET", `/session/${sessionId}/message/${messageId}`);
  }

  async sendMessage(
    sessionId: string,
    opts: {
      messageID?: string;
      model?: { providerID: string; modelID: string };
      agent?: string;
      noReply?: boolean;
      system?: string;
      parts: Array<{ type: "text"; text: string } | { type: "file"; mediaType: string; url: string }>;
    }
  ): Promise<MessageWithParts> {
    return this.request("POST", `/session/${sessionId}/message`, opts);
  }

  async sendMessageAsync(
    sessionId: string,
    opts: {
      model?: { providerID: string; modelID: string };
      agent?: string;
      parts: Array<{ type: "text"; text: string }>;
    }
  ): Promise<void> {
    await this.request("POST", `/session/${sessionId}/prompt_async`, opts);
  }

  async executeCommand(
    sessionId: string,
    opts: {
      messageID?: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      command: string;
      arguments: string[];
    }
  ): Promise<MessageWithParts> {
    return this.request("POST", `/session/${sessionId}/command`, opts);
  }

  async runShell(
    sessionId: string,
    opts: {
      agent: string;
      model?: { providerID: string; modelID: string };
      command: string;
    }
  ): Promise<MessageWithParts> {
    return this.request("POST", `/session/${sessionId}/shell`, opts);
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  async listCommands(): Promise<Command[]> {
    return this.request("GET", "/command");
  }

  // ─── Files ───────────────────────────────────────────────────────────────────

  async searchText(pattern: string): Promise<TextSearchMatch[]> {
    return this.request("GET", "/find", undefined, { pattern });
  }

  async findFiles(
    query: string,
    opts?: { type?: "file" | "directory"; directory?: string; limit?: number }
  ): Promise<string[]> {
    return this.request("GET", "/find/file", undefined, {
      query,
      type: opts?.type,
      directory: opts?.directory,
      limit: opts?.limit ? String(opts.limit) : undefined,
    });
  }

  async findSymbols(query: string): Promise<WorkspaceSymbol[]> {
    return this.request("GET", "/find/symbol", undefined, { query });
  }

  async listFiles(path?: string): Promise<FileNode[]> {
    return this.request("GET", "/file", undefined, path ? { path } : undefined);
  }

  async readFile(path: string): Promise<FileContent> {
    return this.request("GET", "/file/content", undefined, { path });
  }

  async getFileStatus(): Promise<FileStatus[]> {
    return this.request("GET", "/file/status");
  }

  // ─── Agents ──────────────────────────────────────────────────────────────────

  async listAgents(): Promise<Agent[]> {
    return this.request("GET", "/agent");
  }

  // ─── LSP / Formatters / MCP ──────────────────────────────────────────────────

  async getLspStatus(): Promise<LSPStatus[]> {
    return this.request("GET", "/lsp");
  }

  async getFormatterStatus(): Promise<FormatterStatus[]> {
    return this.request("GET", "/formatter");
  }

  async getMcpStatus(): Promise<Record<string, MCPStatus>> {
    return this.request("GET", "/mcp");
  }

  async addMcp(name: string, config: unknown): Promise<MCPStatus> {
    return this.request("POST", "/mcp", { name, config });
  }

  // ─── TUI ─────────────────────────────────────────────────────────────────────

  async tuiAppendPrompt(text: string): Promise<boolean> {
    return this.request("POST", "/tui/append-prompt", { text });
  }

  async tuiSubmitPrompt(): Promise<boolean> {
    return this.request("POST", "/tui/submit-prompt");
  }

  async tuiClearPrompt(): Promise<boolean> {
    return this.request("POST", "/tui/clear-prompt");
  }

  async tuiShowToast(message: string, variant: "success" | "error" | "info" | "warning", title?: string): Promise<boolean> {
    return this.request("POST", "/tui/show-toast", { message, variant, title });
  }

  async tuiOpenHelp(): Promise<boolean> {
    return this.request("POST", "/tui/open-help");
  }

  async tuiOpenSessions(): Promise<boolean> {
    return this.request("POST", "/tui/open-sessions");
  }

  async tuiOpenThemes(): Promise<boolean> {
    return this.request("POST", "/tui/open-themes");
  }

  async tuiOpenModels(): Promise<boolean> {
    return this.request("POST", "/tui/open-models");
  }

  async tuiExecuteCommand(command: string): Promise<boolean> {
    return this.request("POST", "/tui/execute-command", { command });
  }

  // ─── Instance ────────────────────────────────────────────────────────────────

  async dispose(): Promise<boolean> {
    return this.request("POST", "/instance/dispose");
  }

  // ─── Events (SSE) ────────────────────────────────────────────────────────────

  subscribeToEvents(
    onEvent: (event: { type: string; properties?: Record<string, unknown> }) => void,
    onError?: (err: Error) => void
  ): () => void {
    const url = `${this.baseUrl}/event`;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;

      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };
      if (this.authHeader) headers["Authorization"] = this.authHeader;

      fetch(url, { method: "GET", headers })
        .then(async (res) => {
          if (!res.ok || !res.body) {
            throw new Error(`SSE connect failed: ${res.status}`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            let eventType = "message";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataStr = line.slice(6).trim();
              } else if (line === "") {
                if (dataStr) {
                  try {
                    const parsed = JSON.parse(dataStr);
                    // Server embeds type inside the JSON payload itself.
                    // Use parsed.type when present, fall back to SSE event: field.
                    const resolvedType: string =
                      (parsed as any).type ?? eventType;
                    const properties =
                      (parsed as any).properties ?? parsed;
                    onEvent({ type: resolvedType, properties });
                  } catch {
                    onEvent({ type: eventType });
                  }
                  eventType = "message";
                  dataStr = "";
                }
              }
            }
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            onError?.(err);
            // Reconnect after 3 seconds
            timeout = setTimeout(connect, 3000);
          }
        });
    };

    connect();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// ─── Singleton store ─────────────────────────────────────────────────────────

let _client: OpencodeClient | null = null;

export async function loadClient(): Promise<OpencodeClient | null> {
  const url = await AsyncStorage.getItem(SERVER_URL_KEY);
  if (!url) return null;
  const authStr = await AsyncStorage.getItem(SERVER_AUTH_KEY);
  const auth = authStr ? JSON.parse(authStr) : undefined;
  _client = new OpencodeClient(url, auth);
  return _client;
}

export function getClient(): OpencodeClient | null {
  return _client;
}

export function setClient(url: string, auth?: { username: string; password: string }): OpencodeClient {
  _client = new OpencodeClient(url, auth);
  return _client;
}
