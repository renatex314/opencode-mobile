import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { Todo } from "../types/opencode";

const PRIORITY_COLOR: Record<string, string> = {
  high: "#f85149",
  medium: "#f0883e",
  low: "#3fb950",
};

function TodoItem({ todo }: { todo: Todo }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#161b22",
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#30363d",
        padding: 14,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: todo.completed ? "#3fb950" : "#30363d",
          backgroundColor: todo.completed ? "#0d2a1a" : "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {todo.completed && (
          <Ionicons name="checkmark" size={12} color="#3fb950" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: todo.completed ? "#8b949e" : "#e6edf3",
            fontSize: 14,
            lineHeight: 20,
            textDecorationLine: todo.completed ? "line-through" : "none",
          }}
        >
          {todo.title}
        </Text>
        {todo.priority && (
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: "#0d1117",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
              marginTop: 6,
              borderWidth: 1,
              borderColor: PRIORITY_COLOR[todo.priority] ?? "#30363d",
            }}
          >
            <Text
              style={{
                color: PRIORITY_COLOR[todo.priority] ?? "#8b949e",
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              {todo.priority}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function SessionTodosScreen() {
  const route = useRoute();
  const params = route.params as { sessionId: string };
  const { client } = useServer();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (quiet = false) => {
    if (!client) return;
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await client.getSessionTodos(params.sessionId);
      setTodos(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load todos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [client, params.sessionId]);

  const pending = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);

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
      ) : (
        <FlatList
          data={[...pending, ...completed]}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#58a6ff"
            />
          }
          ListHeaderComponent={
            todos.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 8,
                  gap: 12,
                }}
              >
                <Text style={{ color: "#8b949e", fontSize: 13 }}>
                  {pending.length} pending
                </Text>
                <Text style={{ color: "#3fb950", fontSize: 13 }}>
                  {completed.length} done
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
              <Ionicons name="checkmark-done-outline" size={48} color="#30363d" />
              <Text style={{ color: "#6e7681", marginTop: 12, fontSize: 15 }}>
                No todos for this session
              </Text>
            </View>
          }
          renderItem={({ item }) => <TodoItem todo={item} />}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  );
}
