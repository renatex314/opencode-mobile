import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { Config, VcsInfo, PathInfo } from "../types/opencode";

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        color: "#8b949e",
        fontSize: 11,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 20,
        marginBottom: 6,
        marginHorizontal: 16,
      }}
    >
      {title}
    </Text>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  right,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#161b22",
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: "#21262d",
      }}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={danger ? "#f85149" : "#8b949e"}
        style={{ marginRight: 12 }}
      />
      <Text
        style={{
          color: danger ? "#f85149" : "#e6edf3",
          fontSize: 15,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {value !== undefined && (
        <Text style={{ color: "#8b949e", fontSize: 13 }}>{value}</Text>
      )}
      {right}
      {onPress && !right && (
        <Ionicons name="chevron-forward" size={16} color="#6e7681" style={{ marginLeft: 6 }} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { client, serverUrl, disconnect, connected } = useServer();
  const [config, setConfig] = useState<Config | null>(null);
  const [vcs, setVcs] = useState<VcsInfo | null>(null);
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState("");
  const [lspStatus, setLspStatus] = useState<Array<{ name: string; running: boolean }>>([]);
  const [mcpStatus, setMcpStatus] = useState<Record<string, { running: boolean; error?: string }>>({});
  const [formatterStatus, setFormatterStatus] = useState<Array<{ name: string; running: boolean }>>([]);
  const [modelModal, setModelModal] = useState(false);
  const [modelInput, setModelInput] = useState("");

  useEffect(() => {
    if (!client) return;
    Promise.all([
      client.getConfig(),
      client.getVcs(),
      client.getPath(),
      client.health(),
      client.getLspStatus(),
      client.getMcpStatus(),
      client.getFormatterStatus(),
    ])
      .then(([cfg, v, p, h, lsp, mcp, fmt]) => {
        setConfig(cfg);
        setVcs(v);
        setPathInfo(p);
        setVersion(h.version);
        setLspStatus(lsp);
        setMcpStatus(mcp);
        setFormatterStatus(fmt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [client]);

  const handleUpdateModel = async () => {
    if (!client || !modelInput.trim()) return;
    try {
      const updated = await client.updateConfig({ model: modelInput.trim() });
      setConfig(updated);
      setModelModal(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDisconnect = () => {
    Alert.alert("Disconnect", "Disconnect from the OpenCode server?", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: disconnect },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Server info */}
        <SectionHeader title="Connection" />
        <View
          style={{
            backgroundColor: "#161b22",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#30363d",
          }}
        >
          <Row
            icon="radio-outline"
            label="Server"
            value={serverUrl.replace(/^https?:\/\//, "")}
          />
          <Row icon="code-working-outline" label="Version" value={version || "—"} />
          <Row
            icon="folder-outline"
            label="Working directory"
            value={pathInfo?.cwd?.split("/").pop() ?? pathInfo?.cwd ?? "—"}
          />
        </View>

        {/* Git info */}
        {vcs && (
          <>
            <SectionHeader title="Git" />
            <View
              style={{
                backgroundColor: "#161b22",
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#30363d",
              }}
            >
              <Row
                icon="git-branch-outline"
                label="Branch"
                value={vcs.branch ?? "—"}
              />
              <Row
                icon={vcs.dirty ? "warning-outline" : "checkmark-circle-outline"}
                label="Status"
                value={vcs.dirty ? "Modified" : "Clean"}
              />
              {(vcs.ahead !== undefined || vcs.behind !== undefined) && (
                <Row
                  icon="swap-vertical-outline"
                  label="Ahead / Behind"
                  value={`↑${vcs.ahead ?? 0} ↓${vcs.behind ?? 0}`}
                />
              )}
            </View>
          </>
        )}

        {/* Config */}
        <SectionHeader title="Configuration" />
        <View
          style={{
            backgroundColor: "#161b22",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#30363d",
          }}
        >
          <Row
            icon="sparkles-outline"
            label="Default model"
            value={config?.model ?? "Not set"}
            onPress={() => {
              setModelInput(config?.model ?? "");
              setModelModal(true);
            }}
          />
          <Row
            icon="share-social-outline"
            label="Auto-share sessions"
            right={
              <Switch
                value={!!config?.autoshare}
                onValueChange={async (val) => {
                  if (!client) return;
                  const updated = await client.updateConfig({ autoshare: val });
                  setConfig(updated);
                }}
                trackColor={{ false: "#30363d", true: "#1f6feb" }}
                thumbColor={config?.autoshare ? "#58a6ff" : "#8b949e"}
              />
            }
          />
        </View>

        {/* LSP */}
        {lspStatus.length > 0 && (
          <>
            <SectionHeader title="LSP Servers" />
            <View
              style={{
                backgroundColor: "#161b22",
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#30363d",
              }}
            >
              {lspStatus.map((lsp) => (
                <Row
                  key={lsp.name}
                  icon={lsp.running ? "checkmark-circle-outline" : "close-circle-outline"}
                  label={lsp.name}
                  value={lsp.running ? "Running" : "Stopped"}
                />
              ))}
            </View>
          </>
        )}

        {/* Formatters */}
        {formatterStatus.length > 0 && (
          <>
            <SectionHeader title="Formatters" />
            <View
              style={{
                backgroundColor: "#161b22",
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#30363d",
              }}
            >
              {formatterStatus.map((fmt) => (
                <Row
                  key={fmt.name}
                  icon={fmt.running ? "checkmark-circle-outline" : "close-circle-outline"}
                  label={fmt.name}
                  value={fmt.running ? "Running" : "Stopped"}
                />
              ))}
            </View>
          </>
        )}

        {/* MCP */}
        {Object.keys(mcpStatus).length > 0 && (
          <>
            <SectionHeader title="MCP Servers" />
            <View
              style={{
                backgroundColor: "#161b22",
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#30363d",
              }}
            >
              {Object.entries(mcpStatus).map(([name, status]) => (
                <Row
                  key={name}
                  icon={status.running ? "server-outline" : "close-circle-outline"}
                  label={name}
                  value={
                    status.error
                      ? "Error"
                      : status.running
                      ? "Running"
                      : "Stopped"
                  }
                />
              ))}
            </View>
          </>
        )}

        {/* Danger zone */}
        <SectionHeader title="Account" />
        <View
          style={{
            backgroundColor: "#161b22",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#30363d",
          }}
        >
          <Row
            icon="log-out-outline"
            label="Disconnect from server"
            onPress={handleDisconnect}
            danger
          />
        </View>

        {loading && (
          <View style={{ alignItems: "center", marginTop: 20 }}>
            <ActivityIndicator color="#58a6ff" />
          </View>
        )}
      </ScrollView>

      {/* Model Modal */}
      <Modal
        visible={modelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setModelModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
            activeOpacity={1}
            onPress={() => setModelModal(false)}
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
                padding: 20,
              }}
            >
              <Text style={{ color: "#e6edf3", fontWeight: "bold", fontSize: 16, marginBottom: 12 }}>
                Set Default Model
              </Text>
              <TextInput
                value={modelInput}
                onChangeText={setModelInput}
                placeholder="anthropic/claude-opus-4-5"
                placeholderTextColor="#6e7681"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: "#21262d",
                  borderWidth: 1,
                  borderColor: "#30363d",
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: "#e6edf3",
                  fontSize: 14,
                  marginBottom: 16,
                  fontFamily: "monospace",
                }}
              />
              <TouchableOpacity
                onPress={handleUpdateModel}
                disabled={!modelInput.trim()}
                style={{
                  backgroundColor: modelInput.trim() ? "#1f6feb" : "#21262d",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#e6edf3", fontWeight: "bold", fontSize: 15 }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
