import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import SyntaxHighlighter from "react-native-syntax-highlighter";
import { vs2015 } from "react-native-syntax-highlighter";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    mdx: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    graphql: "graphql",
    dockerfile: "dockerfile",
  };
  return map[ext ?? ""] ?? "text";
}

const LINE_HEIGHT = 20;
const FONT_SIZE = 13;

export default function CodeEditorScreen() {
  const route = useRoute();
  const navigation = useNavigation<Nav>();
  const { client, sessions } = useServer();
  const params = route.params as { path: string; content?: string };

  const [content, setContent] = useState(params.content ?? "");
  const [editedContent, setEditedContent] = useState(params.content ?? "");
  const [loading, setLoading] = useState(!params.content);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [language, setLanguage] = useState(getLanguage(params.path));
  const [findText, setFindText] = useState("");
  const [showFind, setShowFind] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions]);

  useEffect(() => {
    if (!params.content && client) {
      client
        .readFile(params.path)
        .then((fc) => {
          setContent(fc.content);
          setEditedContent(fc.content);
        })
        .catch((e) => Alert.alert("Error", e.message))
        .finally(() => setLoading(false));
    }
  }, []);

  const lineCount = editedContent.split("\n").length;
  const hasChanges = editedContent !== content;

  const handleSave = async () => {
    if (!client || !hasChanges) return;
    // We'll send the file edit as an AI message for safety
    Alert.alert(
      "Save file",
      `Save changes to ${params.path.split("/").pop()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save via AI",
          onPress: async () => {
            if (!selectedSessionId) {
              Alert.alert("No session", "Please select a session from the Sessions tab first");
              return;
            }
            setSaving(true);
            try {
              await client.sendMessage(selectedSessionId, {
                parts: [
                  {
                    type: "text",
                    text: `Please write the following content exactly to the file ${params.path}:\n\`\`\`\n${editedContent}\n\`\`\``,
                  },
                ],
              });
              setContent(editedContent);
              Alert.alert("Saved", "File edit has been sent to OpenCode");
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleAiEdit = async () => {
    if (!client || !aiPrompt.trim() || !selectedSessionId) return;
    setAiRunning(true);
    setAiModal(false);
    try {
      await client.sendMessage(selectedSessionId, {
        parts: [
          {
            type: "text",
            text: `In the file ${params.path}, ${aiPrompt}`,
          },
        ],
      });
      // Reload file after AI edits
      setTimeout(async () => {
        try {
          const fc = await client.readFile(params.path);
          setContent(fc.content);
          setEditedContent(fc.content);
        } catch {}
        setAiRunning(false);
      }, 3000);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
      setAiRunning(false);
    }
    setAiPrompt("");
  };

  const highlightMatches = (code: string, find: string) => {
    if (!find) return code;
    // Just return code as-is for highlighted view (find overlay handles it)
    return code;
  };

  const matchCount = showFind && findText
    ? (editedContent.match(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }} edges={["bottom"]}>
      {/* Toolbar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#161b22",
          borderBottomWidth: 1,
          borderBottomColor: "#30363d",
          paddingHorizontal: 10,
          paddingVertical: 8,
          gap: 6,
        }}
      >
        {/* Language badge */}
        <View
          style={{
            backgroundColor: "#21262d",
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: "#30363d",
          }}
        >
          <Text style={{ color: "#58a6ff", fontSize: 11, fontFamily: "monospace" }}>
            {language}
          </Text>
        </View>

        <Text style={{ color: "#6e7681", fontSize: 12, flex: 1 }}>
          {lineCount} lines
        </Text>

        {/* Find */}
        <TouchableOpacity
          onPress={() => setShowFind((f) => !f)}
          style={{
            padding: 6,
            backgroundColor: showFind ? "#1f6feb" : "#21262d",
            borderRadius: 6,
          }}
        >
          <Ionicons name="search-outline" size={16} color="#e6edf3" />
        </TouchableOpacity>

        {/* AI Edit */}
        <TouchableOpacity
          onPress={() => setAiModal(true)}
          style={{
            padding: 6,
            backgroundColor: "#21262d",
            borderRadius: 6,
          }}
        >
          <Ionicons name="sparkles-outline" size={16} color="#bc8cff" />
        </TouchableOpacity>

        {/* Edit/View toggle */}
        <TouchableOpacity
          onPress={() => setEditing((e) => !e)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: editing ? "#1c3a1c" : "#21262d",
            borderRadius: 6,
            borderWidth: 1,
            borderColor: editing ? "#3fb950" : "#30363d",
          }}
        >
          <Text style={{ color: editing ? "#3fb950" : "#8b949e", fontSize: 12 }}>
            {editing ? "Viewing" : "Edit"}
          </Text>
        </TouchableOpacity>

        {/* Save */}
        {hasChanges && (
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: "#1f6feb",
              borderRadius: 6,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#e6edf3" />
            ) : (
              <Text style={{ color: "#e6edf3", fontSize: 12, fontWeight: "600" }}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Find bar */}
      {showFind && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#161b22",
            borderBottomWidth: 1,
            borderBottomColor: "#30363d",
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" size={16} color="#8b949e" />
          <TextInput
            value={findText}
            onChangeText={setFindText}
            placeholder="Find in file…"
            placeholderTextColor="#6e7681"
            autoFocus
            style={{ flex: 1, color: "#e6edf3", fontSize: 13 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {matchCount > 0 && (
            <Text style={{ color: "#8b949e", fontSize: 12 }}>
              {matchCount} match{matchCount !== 1 ? "es" : ""}
            </Text>
          )}
          {findText.length > 0 && matchCount === 0 && (
            <Text style={{ color: "#f85149", fontSize: 12 }}>No match</Text>
          )}
          <TouchableOpacity onPress={() => { setFindText(""); setShowFind(false); }}>
            <Ionicons name="close" size={18} color="#6e7681" />
          </TouchableOpacity>
        </View>
      )}

      {/* AI running indicator */}
      {aiRunning && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#1c1c3a",
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <ActivityIndicator size="small" color="#bc8cff" />
          <Text style={{ color: "#bc8cff", fontSize: 12, marginLeft: 8 }}>
            OpenCode is editing the file…
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#58a6ff" />
        </View>
      ) : editing ? (
        /* Edit mode: raw TextInput with line numbers */
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Line numbers */}
          <ScrollView
            style={{
              backgroundColor: "#161b22",
              borderRightWidth: 1,
              borderRightColor: "#21262d",
              minWidth: 44,
            }}
            scrollEnabled={false}
          >
            {editedContent.split("\n").map((_, i) => (
              <Text
                key={i}
                style={{
                  color: "#6e7681",
                  fontSize: FONT_SIZE,
                  lineHeight: LINE_HEIGHT,
                  paddingHorizontal: 8,
                  paddingTop: i === 0 ? 12 : 0,
                  fontFamily: "monospace",
                  textAlign: "right",
                }}
              >
                {i + 1}
              </Text>
            ))}
          </ScrollView>

          <TextInput
            value={editedContent}
            onChangeText={setEditedContent}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              color: "#e6edf3",
              fontSize: FONT_SIZE,
              lineHeight: LINE_HEIGHT,
              fontFamily: "monospace",
              padding: 12,
              textAlignVertical: "top",
            }}
          />
        </View>
      ) : (
        /* View mode: syntax highlighted */
        <ScrollView style={{ flex: 1 }} horizontal>
          <ScrollView>
            <SyntaxHighlighter
              language={language}
              style={vs2015}
              fontSize={FONT_SIZE}
              highlighter="hljs"
              showLineNumbers
              lineNumberStyle={{ color: "#6e7681" }}
            >
              {editedContent}
            </SyntaxHighlighter>
          </ScrollView>
        </ScrollView>
      )}

      {/* AI Edit Modal */}
      <Modal
        visible={aiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAiModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          activeOpacity={1}
          onPress={() => setAiModal(false)}
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
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="sparkles-outline" size={20} color="#bc8cff" />
              <Text style={{ color: "#e6edf3", fontWeight: "bold", fontSize: 16, marginLeft: 8 }}>
                AI Edit
              </Text>
            </View>

            <Text style={{ color: "#8b949e", fontSize: 13, marginBottom: 4 }}>
              Describe the change you want to make to this file
            </Text>

            {!selectedSessionId && (
              <Text style={{ color: "#f85149", fontSize: 12, marginBottom: 8 }}>
                Warning: No session selected. Create a session first.
              </Text>
            )}

            <TextInput
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder='e.g. "add error handling to all functions"'
              placeholderTextColor="#6e7681"
              multiline
              autoFocus
              style={{
                backgroundColor: "#21262d",
                borderWidth: 1,
                borderColor: "#30363d",
                borderRadius: 10,
                padding: 12,
                color: "#e6edf3",
                fontSize: 14,
                minHeight: 80,
                textAlignVertical: "top",
                marginBottom: 16,
              }}
            />

            <TouchableOpacity
              onPress={handleAiEdit}
              disabled={!aiPrompt.trim() || !selectedSessionId}
              style={{
                backgroundColor:
                  !aiPrompt.trim() || !selectedSessionId ? "#21262d" : "#2a1c3a",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor:
                  !aiPrompt.trim() || !selectedSessionId ? "#30363d" : "#bc8cff",
              }}
            >
              <Text
                style={{
                  color:
                    !aiPrompt.trim() || !selectedSessionId ? "#6e7681" : "#bc8cff",
                  fontWeight: "bold",
                  fontSize: 15,
                }}
              >
                Apply with AI
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
