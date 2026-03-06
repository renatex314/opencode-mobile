import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { Session } from "../types/opencode";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SessionCard({
  session,
  isRunning,
  onPress,
  onDelete,
  onShare,
  onFork,
}: {
  session: Session;
  isRunning: boolean;
  onPress: () => void;
  onDelete: () => void;
  onShare: () => void;
  onFork: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="mx-3 mb-2 bg-bg-secondary border border-border rounded-xl overflow-hidden"
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text
              className="text-text-primary font-semibold text-base"
              numberOfLines={1}
            >
              {session.title || "Untitled session"}
            </Text>
            <View className="flex-row items-center mt-1 gap-2">
              {isRunning && (
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-accent-green mr-1" />
                  <Text className="text-accent-green text-xs">Running</Text>
                </View>
              )}
              {session.share && (
                <View className="flex-row items-center">
                  <Ionicons name="share-outline" size={12} color="#8b949e" />
                  <Text className="text-text-muted text-xs ml-0.5">Shared</Text>
                </View>
              )}
              <Text className="text-text-muted text-xs">
                {timeAgo(session.updated)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            className="p-1"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#6e7681" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Context Menu Modal */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View className="absolute bottom-8 right-4 left-4 bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-xl">
            {[
              { icon: "git-branch-outline" as const, label: "Fork session", action: onFork },
              {
                icon: session.share ? ("eye-off-outline" as const) : ("share-outline" as const),
                label: session.share ? "Unshare" : "Share",
                action: onShare,
              },
              {
                icon: "trash-outline" as const,
                label: "Delete session",
                action: onDelete,
                danger: true,
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  setMenuOpen(false);
                  item.action();
                }}
                className="flex-row items-center px-5 py-4 border-b border-border last:border-b-0"
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.danger ? "#f85149" : "#8b949e"}
                />
                <Text
                  className={`ml-3 text-base ${
                    item.danger ? "text-accent-red" : "text-text-primary"
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

export default function SessionsScreen() {
  const navigation = useNavigation<Nav>();
  const { client, sessions, sessionStatus, refreshSessions } = useServer();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newSessionModal, setNewSessionModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredSessions = sessions.filter((s) =>
    (s.title || "Untitled session")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    setLoading(true);
    await refreshSessions();
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!client) return;
    setCreating(true);
    try {
      const session = await client.createSession({ title: newTitle || undefined });
      setNewSessionModal(false);
      setNewTitle("");
      await refreshSessions();
      navigation.navigate("Chat", {
        sessionId: session.id,
        sessionTitle: session.title,
      });
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (session: Session) => {
    Alert.alert(
      "Delete session",
      `Delete "${session.title || "Untitled session"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await client?.deleteSession(session.id);
            await refreshSessions();
          },
        },
      ]
    );
  };

  const handleShare = async (session: Session) => {
    try {
      if (session.share) {
        await client?.unshareSession(session.id);
      } else {
        await client?.shareSession(session.id);
      }
      await refreshSessions();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    }
  };

  const handleFork = async (session: Session) => {
    try {
      const forked = await client?.forkSession(session.id);
      if (forked) {
        await refreshSessions();
        navigation.navigate("Chat", { sessionId: forked.id, sessionTitle: forked.title });
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to fork");
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={["bottom"]}>
      {/* Search bar */}
      <View className="px-3 pt-2 pb-2">
        <View className="flex-row items-center bg-bg-secondary border border-border rounded-xl px-3">
          <Ionicons name="search-outline" size={18} color="#6e7681" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            className="flex-1 py-2.5 ml-2 text-text-primary text-base"
            placeholder="Search sessions…"
            placeholderTextColor="#6e7681"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#6e7681" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={(s) => s.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#58a6ff"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="chatbubbles-outline" size={48} color="#30363d" />
            <Text className="text-text-muted mt-3 text-base">
              {search ? "No sessions match" : "No sessions yet"}
            </Text>
            {!search && (
              <Text className="text-text-muted text-sm mt-1">
                Tap + to start a new session
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            isRunning={!!sessionStatus[item.id]?.running}
            onPress={() =>
              navigation.navigate("Chat", {
                sessionId: item.id,
                sessionTitle: item.title,
              })
            }
            onDelete={() => handleDelete(item)}
            onShare={() => handleShare(item)}
            onFork={() => handleFork(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setNewSessionModal(true)}
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full bg-accent-blue items-center justify-center shadow-lg"
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#0d1117" />
      </TouchableOpacity>

      {/* New Session Modal */}
      <Modal
        visible={newSessionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNewSessionModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/60"
            activeOpacity={1}
            onPress={() => setNewSessionModal(false)}
          >
            <View className="absolute bottom-0 left-0 right-0 bg-bg-secondary border-t border-border rounded-t-2xl p-5">
              <Text className="text-text-primary font-bold text-lg mb-4">
                New Session
              </Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                className="bg-bg-tertiary border border-border rounded-xl px-4 py-3 text-text-primary text-base mb-4"
                placeholder="Session title (optional)"
                placeholderTextColor="#6e7681"
                autoFocus
                onSubmitEditing={handleCreate}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleCreate}
                disabled={creating}
                className="bg-accent-blue rounded-xl py-3.5 items-center"
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator color="#0d1117" />
                ) : (
                  <Text className="text-bg-primary font-bold text-base">
                    Create Session
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
