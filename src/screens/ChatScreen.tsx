import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { useServer } from "../context/ServerContext";
import type {
  MessageWithParts,
  ToolInvocationPart,
  PermissionRequest,
  Provider,
} from "../types/opencode";
import type { RootStackParamList } from "../navigation/RootNavigator";
import SyntaxHighlighter from "react-native-syntax-highlighter";
import { vs2015 } from "react-native-syntax-highlighter";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Markdown styles (GitHub dark) ───────────────────────────────────────────

const MD_STYLES = {
  body: { color: "#e6edf3", fontSize: 15, lineHeight: 22 },
  heading1: { color: "#e6edf3", fontWeight: "700" as const, fontSize: 20, marginVertical: 6 },
  heading2: { color: "#e6edf3", fontWeight: "700" as const, fontSize: 18, marginVertical: 4 },
  heading3: { color: "#e6edf3", fontWeight: "600" as const, fontSize: 16, marginVertical: 4 },
  strong: { color: "#e6edf3", fontWeight: "700" as const },
  em: { color: "#e6edf3", fontStyle: "italic" as const },
  link: { color: "#58a6ff" },
  blockquote: {
    backgroundColor: "#161b22",
    borderLeftWidth: 3,
    borderLeftColor: "#30363d",
    paddingLeft: 10,
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: "#161b22",
    color: "#f0883e",
    fontFamily: "monospace",
    fontSize: 13,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: "#161b22",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  code_block: {
    backgroundColor: "#161b22",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    color: "#e6edf3",
    fontFamily: "monospace",
    fontSize: 12,
  },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { marginVertical: 1 },
  hr: { backgroundColor: "#30363d", height: 1, marginVertical: 8 },
  table: { borderWidth: 1, borderColor: "#30363d", marginVertical: 6 },
  th: { backgroundColor: "#161b22", color: "#e6edf3", padding: 6, fontWeight: "600" as const },
  td: { color: "#e6edf3", padding: 6, borderTopWidth: 1, borderTopColor: "#30363d" },
};

// User bubble markdown styles (white text on blue background)
const MD_STYLES_USER = {
  ...MD_STYLES,
  body: { color: "#ffffff", fontSize: 15, lineHeight: 22 },
  heading1: { ...MD_STYLES.heading1, color: "#ffffff" },
  heading2: { ...MD_STYLES.heading2, color: "#ffffff" },
  heading3: { ...MD_STYLES.heading3, color: "#ffffff" },
  strong: { color: "#ffffff", fontWeight: "700" as const },
  em: { color: "#ffffff", fontStyle: "italic" as const },
  code_inline: { ...MD_STYLES.code_inline, backgroundColor: "rgba(0,0,0,0.2)", color: "#fff" },
  fence: { ...MD_STYLES.fence, backgroundColor: "rgba(0,0,0,0.2)" },
  code_block: { ...MD_STYLES.code_block, backgroundColor: "rgba(0,0,0,0.2)", color: "#fff" },
};

// ─── Tool call bubble ─────────────────────────────────────────────────────────

function ToolCallBubble({ part }: { part: ToolInvocationPart }) {
  const [expanded, setExpanded] = useState(false);
  const inv = part.toolInvocation;
  const isResult = inv.state === "result";
  const icon = isResult ? "checkmark-circle" : "sync";
  const color = isResult ? "#3fb950" : "#f0883e";

  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.8}
      style={{
        backgroundColor: "#0d1117",
        borderWidth: 1,
        borderColor: "#30363d",
        borderRadius: 10,
        padding: 10,
        marginVertical: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name={icon as any} size={14} color={color} />
        <Text
          style={{ color: "#8b949e", fontSize: 12, marginLeft: 6, flex: 1 }}
          numberOfLines={1}
        >
          {inv.toolName}
          {inv.args && Object.keys(inv.args).length > 0
            ? ` — ${Object.values(inv.args)[0]}`
            : ""}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color="#6e7681"
        />
      </View>
      {expanded && (
        <View style={{ marginTop: 8 }}>
          {inv.args && (
            <Text
              style={{ color: "#8b949e", fontSize: 11, fontFamily: "monospace" }}
            >
              {JSON.stringify(inv.args, null, 2)}
            </Text>
          )}
          {isResult && inv.result !== undefined && (
            <Text
              style={{
                color: "#3fb950",
                fontSize: 11,
                fontFamily: "monospace",
                marginTop: 4,
              }}
            >
              {typeof inv.result === "string"
                ? inv.result
                : JSON.stringify(inv.result, null, 2)}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: MessageWithParts }) {
  const isUser = msg.info.role === "user";
  // Resolve timestamp from either shape
  const ts = msg.info.time?.created ?? (msg.info as any).created ?? Date.now();
  // Resolve model label
  const modelLabel =
    msg.info.modelID ??
    msg.info.model?.modelID ??
    null;

  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
        marginVertical: 4,
        marginHorizontal: 12,
      }}
    >
      {!isUser && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: "#1f6feb",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 6,
            }}
          >
            <Ionicons name="code-slash" size={12} color="#e6edf3" />
          </View>
          <Text style={{ color: "#8b949e", fontSize: 11 }}>OpenCode</Text>
          {modelLabel && (
            <Text style={{ color: "#6e7681", fontSize: 10, marginLeft: 6 }}>
              {modelLabel}
            </Text>
          )}
        </View>
      )}

      <View
        style={{
          backgroundColor: isUser ? "#1f6feb" : "#161b22",
          borderRadius: 14,
          borderWidth: isUser ? 0 : 1,
          borderColor: "#30363d",
          padding: 12,
        }}
      >
        {msg.parts.map((part, i) => {
          if (part.type === "text") {
            const text = (part as any).text as string;
            if (!text) return null;
            return (
              <Markdown key={i} style={isUser ? MD_STYLES_USER : MD_STYLES}>
                {text}
              </Markdown>
            );
          }
          if (part.type === "tool-invocation") {
            return <ToolCallBubble key={i} part={part as ToolInvocationPart} />;
          }
          if (part.type === "reasoning") {
            return (
              <View
                key={i}
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: "#bc8cff",
                  paddingLeft: 8,
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    color: "#8b949e",
                    fontSize: 12,
                    fontStyle: "italic",
                  }}
                >
                  {(part as any).reasoning}
                </Text>
              </View>
            );
          }
          // skip step-start, step-finish, patch parts silently
          return null;
        })}

        {msg.info.error && (
          <View
            style={{
              backgroundColor: "#3d1c1c",
              borderRadius: 8,
              padding: 8,
              marginTop: 4,
            }}
          >
            <Text style={{ color: "#f85149", fontSize: 13 }}>
              Error: {msg.info.error.message}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={{
          color: "#6e7681",
          fontSize: 10,
          marginTop: 2,
          alignSelf: isUser ? "flex-end" : "flex-start",
        }}
      >
        {new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

// ─── Model Selector ───────────────────────────────────────────────────────────

interface ModelSelectorProps {
  visible: boolean;
  onClose: () => void;
  selected?: { providerID: string; modelID: string };
  onSelect: (providerID: string, modelID: string) => void;
}

function ModelSelectorModal({
  visible,
  onClose,
  selected,
  onSelect,
}: ModelSelectorProps) {
  const { client } = useServer();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !client) return;
    setLoading(true);
    client
      .getAllProviders()
      .then((data) => {
        const connected = new Set(data.connected);
        setProviders(
          data.all
            .filter((p) => connected.has(p.id))
            .map((p) => ({
              ...p,
              models: Array.isArray(p.models)
                ? p.models
                : Object.values(p.models ?? {}),
            }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, client]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#161b22",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: "#30363d",
            maxHeight: "75%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#30363d",
            }}
          >
            <Ionicons name="hardware-chip-outline" size={18} color="#58a6ff" />
            <Text
              style={{
                color: "#e6edf3",
                fontWeight: "bold",
                fontSize: 16,
                marginLeft: 8,
                flex: 1,
              }}
            >
              Select Model
            </Text>
            {selected && (
              <TouchableOpacity
                onPress={() => {
                  onSelect("", "");
                  onClose();
                }}
              >
                <Text style={{ color: "#8b949e", fontSize: 13 }}>
                  Use default
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator color="#58a6ff" />
            </View>
          ) : providers.length === 0 ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="server-outline" size={36} color="#30363d" />
              <Text
                style={{
                  color: "#6e7681",
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                No connected providers.{"\n"}Connect one in the Providers tab.
              </Text>
            </View>
          ) : (
            <ScrollView>
              {providers.map((provider) => {
                const isExpanded = expandedProvider === provider.id;
                const models = provider.models ?? [];
                return (
                  <View key={provider.id}>
                    <TouchableOpacity
                      onPress={() =>
                        setExpandedProvider(isExpanded ? null : provider.id)
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "#21262d",
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#3fb950",
                          marginRight: 10,
                        }}
                      />
                      <Text
                        style={{
                          color: "#e6edf3",
                          fontSize: 14,
                          fontWeight: "600",
                          flex: 1,
                        }}
                      >
                        {provider.name}
                      </Text>
                      <Text
                        style={{
                          color: "#6e7681",
                          fontSize: 12,
                          marginRight: 8,
                        }}
                      >
                        {models.length} models
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={14}
                        color="#6e7681"
                      />
                    </TouchableOpacity>

                    {isExpanded &&
                      models.map((model) => {
                        const isSelected =
                          selected?.providerID === provider.id &&
                          selected?.modelID === model.id;
                        return (
                          <TouchableOpacity
                            key={model.id}
                            onPress={() => {
                              onSelect(provider.id, model.id);
                              onClose();
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 32,
                              paddingVertical: 11,
                              borderBottomWidth: 1,
                              borderBottomColor: "#21262d",
                              backgroundColor: isSelected
                                ? "#162032"
                                : "transparent",
                            }}
                          >
                            {isSelected && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#58a6ff"
                                style={{ marginRight: 8 }}
                              />
                            )}
                            <Text
                              style={{
                                color: isSelected ? "#58a6ff" : "#e6edf3",
                                fontSize: 13,
                                flex: 1,
                              }}
                            >
                              {model.name}
                            </Text>
                            <View style={{ flexDirection: "row", gap: 4 }}>
                              {model.reasoning && (
                                <View
                                  style={{
                                    backgroundColor: "#2a1c3a",
                                    borderRadius: 4,
                                    paddingHorizontal: 5,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#bc8cff",
                                      fontSize: 10,
                                    }}
                                  >
                                    reasoning
                                  </Text>
                                </View>
                              )}
                              {model.attachment && (
                                <View
                                  style={{
                                    backgroundColor: "#1c2a3a",
                                    borderRadius: 4,
                                    paddingHorizontal: 5,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#58a6ff",
                                      fontSize: 10,
                                    }}
                                  >
                                    vision
                                  </Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const route = useRoute();
  const navigation = useNavigation<Nav>();
  const params = route.params as { sessionId: string; sessionTitle?: string };
  const { client, events } = useServer();

  const [messages, setMessages] = useState<MessageWithParts[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [commandsModal, setCommandsModal] = useState(false);
  const [modelModal, setModelModal] = useState(false);
  const [commands, setCommands] = useState<
    Array<{ name: string; description?: string }>
  >([]);
  const [selectedModel, setSelectedModel] = useState<
    { providerID: string; modelID: string } | undefined
  >();
  const [pendingPermission, setPendingPermission] =
    useState<PermissionRequest | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const sessionId = params.sessionId;

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!client) return;
    try {
      const msgs = await client.listMessages(sessionId);
      setMessages(msgs);
    } catch {}
  }, [client, sessionId]);

  useEffect(() => {
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
    client?.listCommands().then(setCommands).catch(() => {});
  }, []);

  // ── SSE streaming — zero-fetch, pure local state mutations ───────────────────
  //
  // Confirmed event shapes from server (via curl capture):
  //
  //  message.part.delta   → { sessionID, messageID, partID, field:"text", delta:"..." }
  //    → append delta to the matching part's text in local state immediately.
  //
  //  message.part.updated → { part: { sessionID, messageID, id, type, text?, ... } }
  //    → upsert the full part object into the matching message (handles step-start,
  //      tool-invocation, step-finish, and final text snapshot).
  //
  //  message.updated      → { info: { id, sessionID, role, ... } }
  //    → upsert the message info (tokens, finish, etc.) leaving parts intact.
  //
  //  session.status       → { sessionID, status: { type: "busy"|"idle" } }
  //    → drive the running spinner.
  //
  //  session.idle         → { sessionID }
  //    → session finished; do one final fetch to sync any parts we may have missed.

  useEffect(() => {
    const lastEvent = events[0];
    if (!lastEvent) return;

    const props = lastEvent.properties as Record<string, any> | undefined;
    if (!props) return;

    switch (lastEvent.type) {

      // ── Hot path: text delta — no network, pure append ──────────────────────
      case "message.part.delta": {
        if (props.sessionID !== sessionId) break;
        if (props.field !== "text") break;
        const { messageID, partID, delta } = props as {
          messageID: string; partID: string; delta: string;
        };
        setMessages((prev) => {
          const msgIdx = prev.findIndex((m) => m.info.id === messageID);
          if (msgIdx === -1) {
            // Message not yet in state — will be added by message.part.updated
            return prev;
          }
          const msg = prev[msgIdx];
          const partIdx = msg.parts.findIndex((p: any) => p.id === partID);
          let newParts;
          if (partIdx === -1) {
            // Part not yet in state — create a placeholder
            newParts = [...msg.parts, { type: "text", text: delta, id: partID } as any];
          } else {
            newParts = msg.parts.map((p: any, i: number) =>
              i === partIdx ? { ...p, text: (p.text ?? "") + delta } : p
            );
          }
          const next = [...prev];
          next[msgIdx] = { ...msg, parts: newParts };
          return next;
        });
        break;
      }

      // ── Part upsert: handles step-start, tool calls, final text snapshot ────
      case "message.part.updated": {
        const part = props.part as any;
        if (!part) break;
        if (part.sessionID !== sessionId) break;
        const { messageID } = part as { messageID: string };
        setMessages((prev) => {
          const msgIdx = prev.findIndex((m) => m.info.id === messageID);
          if (msgIdx === -1) return prev; // will arrive via message.updated
          const msg = prev[msgIdx];
          const partIdx = msg.parts.findIndex((p: any) => p.id === part.id);
          let newParts;
          if (partIdx === -1) {
            newParts = [...msg.parts, part];
          } else {
            // For text parts: keep the longest text (delta-built vs snapshot)
            const existing = msg.parts[partIdx] as any;
            const merged =
              part.type === "text" && existing.text && part.text &&
              existing.text.length > part.text.length
                ? existing  // already ahead via deltas, don't regress
                : part;
            newParts = msg.parts.map((p: any, i: number) =>
              i === partIdx ? merged : p
            );
          }
          const next = [...prev];
          next[msgIdx] = { ...msg, parts: newParts };
          return next;
        });
        break;
      }

      // ── Message info upsert (role, tokens, finish, etc.) ────────────────────
      case "message.updated": {
        const info = props.info as any;
        if (!info) break;
        if (info.sessionID !== sessionId) break;
        setMessages((prev) => {
          const msgIdx = prev.findIndex((m) => m.info.id === info.id);
          if (msgIdx === -1) {
            // New message skeleton — add it with empty parts
            return [...prev, { info, parts: [] }];
          }
          const next = [...prev];
          next[msgIdx] = { ...prev[msgIdx], info };
          return next;
        });
        break;
      }

      // ── Session busy/idle indicator ──────────────────────────────────────────
      case "session.status": {
        if (props.sessionID !== sessionId) break;
        setIsRunning((props.status as any)?.type === "busy");
        break;
      }

      case "session.idle": {
        if (props.sessionID !== sessionId) break;
        setIsRunning(false);
        // One final fetch to catch anything we may have missed
        loadMessages();
        break;
      }

      default:
        break;
    }
  }, [events]);

  // ── Sending ───────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!client || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await client.sendMessageAsync(sessionId, {
        model: selectedModel,
        parts: [{ type: "text", text }],
      });
      // SSE events will drive all subsequent updates; just load to show user msg immediately
      loadMessages();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleAbort = async () => {
    await client?.abortSession(sessionId);
    setIsRunning(false);
  };

  // ── Permission polling ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isRunning || !client) {
      setPendingPermission(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const status = await client.getSessionStatus();
        const s = status[sessionId] as any;
        if (s?.permissionID && s?.permission) {
          setPendingPermission(s.permission as PermissionRequest);
        } else {
          setPendingPermission(null);
        }
      } catch {}
      if (!cancelled && isRunning) setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [isRunning, client, sessionId]);

  const handleRespondPermission = async (
    response: "allow" | "deny",
    remember?: boolean
  ) => {
    if (!client || !pendingPermission) return;
    try {
      await client.respondToPermission(
        sessionId,
        pendingPermission.id,
        response,
        remember
      );
      setPendingPermission(null);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    }
  };

  // ── Commands ──────────────────────────────────────────────────────────────────

  const handleCommand = async (command: string) => {
    if (!client) return;
    setCommandsModal(false);
    setSending(true);
    try {
      await client.executeCommand(sessionId, { command, arguments: [] });
      await loadMessages();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  // ── Auto-scroll ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100
      );
    }
  }, [messages]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const modelLabel = selectedModel ? selectedModel.modelID : "Default model";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0d1117" }}
      edges={["bottom"]}
    >
      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color="#58a6ff" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={90}
        >
          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.info.id}
            renderItem={({ item }) => <MessageBubble msg={item} />}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: 80,
                }}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={48}
                  color="#30363d"
                />
                <Text
                  style={{ color: "#6e7681", marginTop: 12, fontSize: 15 }}
                >
                  Start the conversation
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
          />

          {/* Running indicator */}
          {isRunning && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 6,
                backgroundColor: "#0d2a1a",
              }}
            >
              <ActivityIndicator size="small" color="#3fb950" />
              <Text
                style={{ color: "#3fb950", fontSize: 12, marginLeft: 8 }}
              >
                OpenCode is thinking…
              </Text>
              <TouchableOpacity
                onPress={handleAbort}
                style={{ marginLeft: "auto", padding: 4 }}
              >
                <Text style={{ color: "#f85149", fontSize: 12 }}>Abort</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Model chip */}
          <TouchableOpacity
            onPress={() => setModelModal(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 6,
              backgroundColor: "#161b22",
              borderTopWidth: 1,
              borderTopColor: "#21262d",
              gap: 6,
            }}
          >
            <Ionicons name="hardware-chip-outline" size={13} color="#8b949e" />
            <Text style={{ color: "#8b949e", fontSize: 12, flex: 1 }}>
              {modelLabel}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#6e7681" />
          </TouchableOpacity>

          {/* Input bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: "#161b22",
              borderTopWidth: 1,
              borderTopColor: "#30363d",
              gap: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => setCommandsModal(true)}
              style={{
                padding: 8,
                backgroundColor: "#21262d",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#30363d",
              }}
            >
              <Ionicons name="flash-outline" size={20} color="#8b949e" />
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message OpenCode…"
              placeholderTextColor="#6e7681"
              multiline
              style={{
                flex: 1,
                backgroundColor: "#21262d",
                borderWidth: 1,
                borderColor: "#30363d",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: "#e6edf3",
                fontSize: 15,
                maxHeight: 120,
              }}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || sending || isRunning}
              style={{
                padding: 10,
                backgroundColor:
                  !input.trim() || sending || isRunning
                    ? "#21262d"
                    : "#1f6feb",
                borderRadius: 10,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#e6edf3" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={
                    !input.trim() || isRunning ? "#6e7681" : "#e6edf3"
                  }
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Model Selector */}
      <ModelSelectorModal
        visible={modelModal}
        onClose={() => setModelModal(false)}
        selected={selectedModel}
        onSelect={(providerID, modelID) => {
          setSelectedModel(
            providerID && modelID ? { providerID, modelID } : undefined
          );
        }}
      />

      {/* Commands Modal */}
      <Modal
        visible={commandsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCommandsModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          activeOpacity={1}
          onPress={() => setCommandsModal(false)}
        >
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#161b22",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderColor: "#30363d",
              maxHeight: 400,
            }}
          >
            <Text
              style={{
                color: "#e6edf3",
                fontWeight: "bold",
                fontSize: 16,
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#30363d",
              }}
            >
              Slash Commands
            </Text>
            <ScrollView>
              {commands.map((cmd) => (
                <TouchableOpacity
                  key={cmd.name}
                  onPress={() => handleCommand(cmd.name)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "#21262d",
                  }}
                >
                  <Ionicons
                    name="terminal-outline"
                    size={16}
                    color="#58a6ff"
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text
                      style={{
                        color: "#e6edf3",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      /{cmd.name}
                    </Text>
                    {cmd.description && (
                      <Text
                        style={{
                          color: "#8b949e",
                          fontSize: 12,
                          marginTop: 1,
                        }}
                      >
                        {cmd.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Permission Modal */}
      <Modal
        visible={!!pendingPermission}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.75)",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#161b22",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#30363d",
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#f0883e"
              />
              <Text
                style={{
                  color: "#e6edf3",
                  fontWeight: "bold",
                  fontSize: 16,
                  marginLeft: 10,
                }}
              >
                Permission Required
              </Text>
            </View>
            {pendingPermission && (
              <>
                <Text
                  style={{
                    color: "#8b949e",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Tool:{" "}
                  <Text style={{ color: "#58a6ff" }}>
                    {pendingPermission.tool}
                  </Text>
                </Text>
                <Text
                  style={{
                    color: "#e6edf3",
                    fontSize: 14,
                    marginBottom: 8,
                    lineHeight: 20,
                  }}
                >
                  {pendingPermission.description}
                </Text>
                {pendingPermission.command && (
                  <View
                    style={{
                      backgroundColor: "#0d1117",
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: "#3fb950",
                        fontSize: 12,
                        fontFamily: "monospace",
                      }}
                    >
                      {pendingPermission.command}
                    </Text>
                  </View>
                )}
              </>
            )}
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleRespondPermission("allow", false)}
                style={{
                  backgroundColor: "#1a4a1a",
                  borderWidth: 1,
                  borderColor: "#3fb950",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#3fb950", fontWeight: "600" }}>
                  Allow once
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondPermission("allow", true)}
                style={{
                  backgroundColor: "#162a16",
                  borderWidth: 1,
                  borderColor: "#3fb950",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#3fb950", fontWeight: "600" }}>
                  Allow always
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondPermission("deny")}
                style={{
                  backgroundColor: "#2d1b1b",
                  borderWidth: 1,
                  borderColor: "#f85149",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#f85149", fontWeight: "600" }}>
                  Deny
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
