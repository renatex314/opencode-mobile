import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { FileDiff } from "../types/opencode";

function DiffLine({ line }: { line: string }) {
  const isAdded = line.startsWith("+") && !line.startsWith("+++");
  const isRemoved = line.startsWith("-") && !line.startsWith("---");
  const isHunk = line.startsWith("@@");
  const isHeader = line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ");

  let bg = "transparent";
  let color = "#8b949e";

  if (isAdded) { bg = "#0d2a1a"; color = "#3fb950"; }
  else if (isRemoved) { bg = "#3d1c1c"; color = "#f85149"; }
  else if (isHunk) { bg = "#1c2d3d"; color = "#58a6ff"; }
  else if (isHeader) { color = "#e6edf3"; }

  return (
    <Text
      style={{
        backgroundColor: bg,
        color,
        fontSize: 11,
        fontFamily: "monospace",
        lineHeight: 16,
        paddingHorizontal: 8,
      }}
    >
      {line}
    </Text>
  );
}

function FileDiffCard({ diff }: { diff: FileDiff }) {
  const [expanded, setExpanded] = useState(true);
  const lines = diff.diff.split("\n");

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#30363d",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        style={{
          backgroundColor: "#161b22",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="document-text-outline" size={14} color="#8b949e" />
        <Text
          style={{
            color: "#e6edf3",
            fontSize: 13,
            fontFamily: "monospace",
            flex: 1,
            marginLeft: 8,
          }}
          numberOfLines={1}
        >
          {diff.path}
        </Text>
        <Text style={{ color: "#3fb950", fontSize: 12, marginRight: 8 }}>
          +{diff.added}
        </Text>
        <Text style={{ color: "#f85149", fontSize: 12, marginRight: 8 }}>
          -{diff.removed}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color="#6e7681"
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ backgroundColor: "#0d1117" }}>
          {lines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function SessionDiffScreen() {
  const route = useRoute();
  const params = route.params as { sessionId: string };
  const { client } = useServer();

  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    client
      .getSessionDiff(params.sessionId)
      .then(setDiffs)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load diff")
      )
      .finally(() => setLoading(false));
  }, [client, params.sessionId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }} edges={["bottom"]}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#58a6ff" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#f85149" />
          <Text style={{ color: "#f85149", marginTop: 12, textAlign: "center" }}>{error}</Text>
        </View>
      ) : diffs.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="git-compare-outline" size={48} color="#30363d" />
          <Text style={{ color: "#6e7681", marginTop: 12, fontSize: 15 }}>
            No changes in this session
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}>
          {/* Summary bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingBottom: 12,
              gap: 16,
            }}
          >
            <Text style={{ color: "#8b949e", fontSize: 13 }}>
              {diffs.length} file{diffs.length !== 1 ? "s" : ""} changed
            </Text>
            <Text style={{ color: "#3fb950", fontSize: 13 }}>
              +{diffs.reduce((s, d) => s + d.added, 0)}
            </Text>
            <Text style={{ color: "#f85149", fontSize: 13 }}>
              -{diffs.reduce((s, d) => s + d.removed, 0)}
            </Text>
          </View>
          {diffs.map((d) => (
            <FileDiffCard key={d.path} diff={d} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
