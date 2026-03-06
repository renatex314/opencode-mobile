import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { Agent } from "../types/opencode";

const TOOL_COLORS: Record<string, string> = {
  bash: "#3fb950",
  read: "#58a6ff",
  write: "#f0883e",
  edit: "#bc8cff",
  glob: "#d29922",
  grep: "#39d353",
};

export default function AgentsScreen() {
  const { client } = useServer();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    client
      .listAgents()
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [client]);

  const renderAgent = ({ item }: { item: Agent }) => {
    const isExpanded = expanded === item.name;

    return (
      <View
        style={{
          marginHorizontal: 12,
          marginBottom: 8,
          backgroundColor: "#161b22",
          borderWidth: 1,
          borderColor: "#30363d",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <TouchableOpacity
          onPress={() => setExpanded(isExpanded ? null : item.name)}
          activeOpacity={0.8}
          style={{ padding: 16 }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "#21262d",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
                borderWidth: 1,
                borderColor: "#30363d",
              }}
            >
              <Ionicons name="hardware-chip-outline" size={18} color="#58a6ff" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: "#e6edf3", fontWeight: "600", fontSize: 15 }}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 3 }}>
                  {item.description}
                </Text>
              )}
              {item.model && (
                <Text style={{ color: "#6e7681", fontSize: 11, marginTop: 2 }}>
                  Model: {item.model}
                </Text>
              )}
            </View>

            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#6e7681"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && item.tools && item.tools.length > 0 && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: "#21262d",
              padding: 14,
            }}
          >
            <Text style={{ color: "#8b949e", fontSize: 12, marginBottom: 8 }}>
              Available tools
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {item.tools.map((tool) => (
                <View
                  key={tool}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#21262d",
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: "#30363d",
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: TOOL_COLORS[tool.toLowerCase()] ?? "#8b949e",
                      marginRight: 5,
                    }}
                  />
                  <Text style={{ color: "#e6edf3", fontSize: 12 }}>{tool}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }} edges={["bottom"]}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#58a6ff" />
        </View>
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.name}
          renderItem={renderAgent}
          ListHeaderComponent={
            <View style={{ padding: 12, paddingBottom: 4 }}>
              <Text style={{ color: "#8b949e", fontSize: 12 }}>
                {agents.length} agent{agents.length !== 1 ? "s" : ""} available
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 80,
              }}
            >
              <Ionicons name="hardware-chip-outline" size={48} color="#30363d" />
              <Text style={{ color: "#6e7681", marginTop: 12, fontSize: 15 }}>
                No agents found
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
          onRefresh={() => {
            if (!client) return;
            setLoading(true);
            client.listAgents().then(setAgents).catch(() => {}).finally(() => setLoading(false));
          }}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}
