import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function colorForLine(line: string): string {
  const s = stripAnsi(line);
  if (s.startsWith("$") || s.startsWith(">")) return "#58a6ff";
  if (/error|fail|fatal/i.test(s)) return "#f85149";
  if (/warn/i.test(s)) return "#d29922";
  if (/success|done|ok/i.test(s)) return "#3fb950";
  return "#e6edf3";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TerminalLine {
  id: string;
  text: string;
  isCommand?: boolean;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShellScreen() {
  const { client, sessions, events } = useServer();

  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "welcome-0",
      text: "OpenCode Shell — commands are sent as session messages",
      isCommand: false,
    },
    {
      id: "welcome-1",
      text: "Select a session below, type a command, and press Run.",
      isCommand: false,
    },
    { id: "welcome-2", text: "", isCommand: false },
  ]);

  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Track the message IDs we submitted so we only listen to our own responses
  const pendingMessageIds = useRef<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  // ── Session auto-select ───────────────────────────────────────────────────

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const appendLine = useCallback((text: string, isCommand = false) => {
    setLines((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), text, isCommand },
    ]);
    setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80
    );
  }, []);

  // ── SSE-driven output rendering ───────────────────────────────────────────
  // When the server responds to our shell command message, SSE fires
  // message.part.created / message.part.updated events. We append the text
  // content to the terminal as it streams in.

  const lastRenderedPartText = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const lastEvent = events[0];
    if (!lastEvent) return;

    const props = lastEvent.properties as
      | { sessionID?: string; messageID?: string; partID?: string }
      | undefined;

    // Only handle events for the active session
    if (!props?.sessionID || props.sessionID !== selectedSessionId) return;
    // Only handle responses to our own messages
    if (!props.messageID || !pendingMessageIds.current.has(props.messageID))
      return;

    const type = lastEvent.type;

    if (type === "message.part.created" || type === "message.part.updated") {
      // Fetch the updated message and extract new text delta
      if (!client || !props.messageID) return;
      client
        .getMessage(selectedSessionId!, props.messageID)
        .then((msg) => {
          for (const part of msg.parts) {
            if (part.type === "text") {
              const key = `${props.messageID}`;
              const prev = lastRenderedPartText.current.get(key) ?? "";
              const fullText = (part as any).text as string;
              // Only append the new delta since last render
              const delta = fullText.slice(prev.length);
              if (delta) {
                lastRenderedPartText.current.set(key, fullText);
                delta.split("\n").forEach((line, i, arr) => {
                  // Don't emit trailing empty string from the split
                  if (i === arr.length - 1 && line === "") return;
                  appendLine(line);
                });
              }
            }
          }
        })
        .catch(() => {});
    }

    if (type === "message.updated") {
      // Message finished streaming — mark as done
      setRunning(false);
      appendLine("");
      pendingMessageIds.current.delete(props.messageID!);
    }
  }, [events, selectedSessionId, client, appendLine]);

  // ── Run command ───────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (!client || !command.trim() || running) return;

    const cmd = command.trim();
    appendLine(`$ ${cmd}`, true);
    setCommand("");
    setHistory((h) => [cmd, ...h.slice(0, 49)]);
    setHistoryIndex(-1);

    // Ensure a session is available
    let sessionId = selectedSessionId;
    if (!sessionId) {
      try {
        const s = await client.createSession({ title: "Shell" });
        sessionId = s.id;
        setSelectedSessionId(s.id);
      } catch {
        appendLine("Error: could not create a session");
        return;
      }
    }

    setRunning(true);
    lastRenderedPartText.current.clear();

    try {
      // Send as a regular message with noReply: false so the AI/shell executes it
      // We use the sendMessage (sync) call so we get back a messageID to track.
      const userMsg = await client.sendMessage(sessionId, {
        parts: [{ type: "text", text: cmd }],
        noReply: false,
      });

      // Register the message ID — SSE handler will pick up the assistant reply
      // The assistant reply will have a different messageID; we track via session events.
      // Since sendMessage returns the user message, we track the session itself.
      // Mark as pending so we listen to all assistant messages in this session.
      pendingMessageIds.current.add("__session__" + sessionId);
    } catch (e: unknown) {
      appendLine(
        `Error: ${e instanceof Error ? e.message : "command failed"}`
      );
      setRunning(false);
      appendLine("");
    }
  };

  // ── SSE for general session replies (when we can't track by messageID) ────

  useEffect(() => {
    const lastEvent = events[0];
    if (!lastEvent) return;

    const props = lastEvent.properties as
      | { sessionID?: string; messageID?: string }
      | undefined;

    if (!props?.sessionID || props.sessionID !== selectedSessionId) return;

    // Check if we're waiting for a reply in this session
    const sessionKey = "__session__" + selectedSessionId;
    if (!pendingMessageIds.current.has(sessionKey)) return;

    if (
      lastEvent.type === "message.part.created" ||
      lastEvent.type === "message.part.updated"
    ) {
      if (!client || !props.messageID) return;
      client
        .getMessage(selectedSessionId!, props.messageID)
        .then((msg) => {
          // Skip user messages
          if (msg.info.role === "user") return;
          const key = props.messageID!;
          const prev = lastRenderedPartText.current.get(key) ?? "";
          for (const part of msg.parts) {
            if (part.type === "text") {
              const fullText = (part as any).text as string;
              const delta = fullText.slice(prev.length);
              if (delta) {
                lastRenderedPartText.current.set(key, fullText);
                delta.split("\n").forEach((line, i, arr) => {
                  if (i === arr.length - 1 && line === "") return;
                  appendLine(line);
                });
              }
            }
          }
        })
        .catch(() => {});
    }

    if (lastEvent.type === "message.updated") {
      // Check if this is the assistant's final message
      if (!client || !props.messageID) return;
      client
        .getMessage(selectedSessionId!, props.messageID)
        .then((msg) => {
          if (msg.info.role === "assistant") {
            setRunning(false);
            appendLine("");
            pendingMessageIds.current.delete(sessionKey);
          }
        })
        .catch(() => {
          setRunning(false);
          pendingMessageIds.current.delete(sessionKey);
        });
    }

    // Session no longer running → stop spinner
    if (lastEvent.type === "session.updated") {
      setRunning(false);
      pendingMessageIds.current.delete(sessionKey);
    }
  }, [events, selectedSessionId, client, appendLine]);

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = () => {
    setLines([{ id: String(Date.now()), text: "", isCommand: false }]);
    lastRenderedPartText.current.clear();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0d1117" }}
      edges={["bottom"]}
    >
      {/* Session selector */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#161b22",
          borderBottomWidth: 1,
          borderBottomColor: "#30363d",
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 8,
        }}
      >
        <Ionicons name="layers-outline" size={16} color="#8b949e" />
        <Text style={{ color: "#8b949e", fontSize: 12 }}>Session:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={{ flexDirection: "row", gap: 6 }}>
            {sessions.slice(0, 6).map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setSelectedSessionId(s.id);
                  handleClear();
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor:
                    selectedSessionId === s.id ? "#1f6feb" : "#21262d",
                  borderWidth: 1,
                  borderColor:
                    selectedSessionId === s.id ? "#388bfd" : "#30363d",
                }}
              >
                <Text
                  style={{
                    color:
                      selectedSessionId === s.id ? "#e6edf3" : "#8b949e",
                    fontSize: 12,
                  }}
                  numberOfLines={1}
                >
                  {s.title || s.id.slice(0, 8)}
                </Text>
              </TouchableOpacity>
            ))}
            {sessions.length === 0 && (
              <Text style={{ color: "#6e7681", fontSize: 12 }}>
                No sessions — create one in the Sessions tab
              </Text>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity onPress={handleClear}>
          <Ionicons name="trash-outline" size={18} color="#6e7681" />
        </TouchableOpacity>
      </View>

      {/* Terminal output */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {lines.map((line) => (
          <Text
            key={line.id}
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 20,
              color: line.isCommand ? "#58a6ff" : colorForLine(line.text),
            }}
          >
            {line.text || " "}
          </Text>
        ))}
        {running && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <ActivityIndicator size="small" color="#3fb950" />
            <Text
              style={{
                color: "#3fb950",
                fontSize: 13,
                marginLeft: 8,
                fontFamily: "monospace",
              }}
            >
              running…
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#161b22",
            borderTopWidth: 1,
            borderTopColor: "#30363d",
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 8,
          }}
        >
          <Text
            style={{ color: "#58a6ff", fontSize: 14, fontFamily: "monospace" }}
          >
            $
          </Text>
          <TextInput
            value={command}
            onChangeText={setCommand}
            placeholder="Enter command…"
            placeholderTextColor="#6e7681"
            style={{
              flex: 1,
              color: "#e6edf3",
              fontSize: 14,
              fontFamily: "monospace",
              paddingVertical: 8,
            }}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleRun}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={handleRun}
            disabled={!command.trim() || running || !selectedSessionId}
            style={{
              padding: 8,
              backgroundColor:
                !command.trim() || running || !selectedSessionId
                  ? "#21262d"
                  : "#1f6feb",
              borderRadius: 8,
            }}
          >
            {running ? (
              <ActivityIndicator size="small" color="#e6edf3" />
            ) : (
              <Ionicons
                name="play"
                size={18}
                color={
                  !command.trim() || !selectedSessionId ? "#6e7681" : "#e6edf3"
                }
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
