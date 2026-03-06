import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OpencodeClient, SERVER_URL_KEY, SERVER_AUTH_KEY, setClient } from "../api/client";
import type { Session, SessionStatus } from "../types/opencode";

interface ServerContextValue {
  client: OpencodeClient | null;
  connected: boolean;
  serverUrl: string;
  connecting: boolean;
  error: string | null;
  sessions: Session[];
  sessionStatus: Record<string, SessionStatus>;
  activeSessionId: string | null;
  connect: (url: string, auth?: { username: string; password: string }) => Promise<boolean>;
  disconnect: () => void;
  refreshSessions: () => Promise<void>;
  setActiveSession: (id: string | null) => void;
  events: Array<{ type: string; properties?: Record<string, unknown> }>;
}

const ServerContext = createContext<ServerContextValue>({
  client: null,
  connected: false,
  serverUrl: "",
  connecting: false,
  error: null,
  sessions: [],
  sessionStatus: {},
  activeSessionId: null,
  connect: async () => false,
  disconnect: () => {},
  refreshSessions: async () => {},
  setActiveSession: () => {},
  events: [],
});

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [client, setClientState] = useState<OpencodeClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionStatus, setSessionStatus] = useState<Record<string, SessionStatus>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ type: string; properties?: Record<string, unknown> }>>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  const connect = useCallback(async (url: string, auth?: { username: string; password: string }): Promise<boolean> => {
    setConnecting(true);
    setError(null);
    try {
      const c = setClient(url, auth);
      const health = await c.health();
      if (!health.healthy) throw new Error("Server is not healthy");

      await AsyncStorage.setItem(SERVER_URL_KEY, url);
      if (auth) {
        await AsyncStorage.setItem(SERVER_AUTH_KEY, JSON.stringify(auth));
      } else {
        await AsyncStorage.removeItem(SERVER_AUTH_KEY);
      }

      setClientState(c);
      setServerUrl(url);
      setConnected(true);

      // Subscribe to events
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = c.subscribeToEvents(
        (event) => {
          setEvents((prev) => [event, ...prev].slice(0, 100));
          // Refresh session status on relevant events
          if (
            event.type === "session.updated" ||
            event.type === "session.created" ||
            event.type === "session.deleted"
          ) {
            c.listSessions().then(setSessions).catch(() => {});
            c.getSessionStatus().then(setSessionStatus).catch(() => {});
          }
        },
        () => {}
      );

      // Load sessions
      const [sess, status] = await Promise.all([
        c.listSessions(),
        c.getSessionStatus(),
      ]);
      setSessions(sess);
      setSessionStatus(status);

      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setConnected(false);
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setClientState(null);
    setConnected(false);
    setServerUrl("");
    setSessions([]);
    setSessionStatus({});
    setActiveSessionId(null);
    AsyncStorage.removeItem(SERVER_URL_KEY);
    AsyncStorage.removeItem(SERVER_AUTH_KEY);
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!client) return;
    try {
      const [sess, status] = await Promise.all([
        client.listSessions(),
        client.getSessionStatus(),
      ]);
      setSessions(sess);
      setSessionStatus(status);
    } catch {}
  }, [client]);

  // Try to restore connection on mount
  useEffect(() => {
    (async () => {
      const url = await AsyncStorage.getItem(SERVER_URL_KEY);
      if (url) {
        const authStr = await AsyncStorage.getItem(SERVER_AUTH_KEY);
        const auth = authStr ? JSON.parse(authStr) : undefined;
        await connect(url, auth);
      }
    })();

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  return (
    <ServerContext.Provider
      value={{
        client,
        connected,
        serverUrl,
        connecting,
        error,
        sessions,
        sessionStatus,
        activeSessionId,
        connect,
        disconnect,
        refreshSessions,
        setActiveSession: setActiveSessionId,
        events,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  return useContext(ServerContext);
}
