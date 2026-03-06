import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { Provider } from "../types/opencode";

type ProviderWithConnected = Provider & { connected: boolean };

export default function ProvidersScreen() {
  const { client } = useServer();
  const [providers, setProviders] = useState<ProviderWithConnected[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState<{ provider: ProviderWithConnected } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.getAllProviders();
      const connectedSet = new Set(data.connected);
      setProviders(
        data.all.map((p) => ({ ...p, connected: connectedSet.has(p.id) }))
      );
    } catch {
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    load();
  }, []);

  const handleSetAuth = async () => {
    if (!client || !authModal) return;
    setSaving(true);
    try {
      await client.setAuth(authModal.provider.id, { type: "api", key: apiKey });
      setAuthModal(null);
      setApiKey("");
      await load();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to set auth");
    } finally {
      setSaving(false);
    }
  };

  const renderProvider = ({ item }: { item: ProviderWithConnected }) => {
    const isExpanded = expanded === item.id;

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
          onPress={() => setExpanded(isExpanded ? null : item.id)}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
          }}
        >
          {/* Status dot */}
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: item.connected ? "#3fb950" : "#6e7681",
              marginRight: 12,
            }}
          />

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#e6edf3", fontWeight: "600", fontSize: 15 }}>
              {item.name}
            </Text>
            <Text style={{ color: "#8b949e", fontSize: 12, marginTop: 2 }}>
              {item.connected ? "Connected" : "Not connected"} · {item.models.length} models
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                setAuthModal({ provider: item });
                setApiKey("");
              }}
              style={{
                backgroundColor: "#21262d",
                borderWidth: 1,
                borderColor: "#30363d",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: "#58a6ff", fontSize: 12 }}>
                {item.connected ? "Re-auth" : "Connect"}
              </Text>
            </TouchableOpacity>

            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#6e7681"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: "#21262d",
              padding: 12,
            }}
          >
            <Text style={{ color: "#8b949e", fontSize: 12, marginBottom: 8 }}>
              Available models
            </Text>
            {item.models.map((m) => (
              <View
                key={m.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: "#21262d",
                }}
              >
                <Text style={{ color: "#e6edf3", fontSize: 13, flex: 1 }}>
                  {m.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {m.attachment && (
                    <View
                      style={{
                        backgroundColor: "#1c2a3a",
                        borderRadius: 4,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: "#58a6ff", fontSize: 10 }}>vision</Text>
                    </View>
                  )}
                  {m.reasoning && (
                    <View
                      style={{
                        backgroundColor: "#2a1c3a",
                        borderRadius: 4,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: "#bc8cff", fontSize: 10 }}>reasoning</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
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
          data={providers}
          keyExtractor={(p) => p.id}
          renderItem={renderProvider}
          ListHeaderComponent={
            <View style={{ padding: 12, paddingBottom: 4 }}>
              <Text style={{ color: "#8b949e", fontSize: 12 }}>
                {providers.filter((p) => p.connected).length} of {providers.length} connected
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 60,
              }}
            >
              <Ionicons name="server-outline" size={48} color="#30363d" />
              <Text style={{ color: "#6e7681", marginTop: 12 }}>
                No providers found
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
          onRefresh={load}
          refreshing={loading}
        />
      )}

      {/* Auth modal */}
      <Modal
        visible={!!authModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAuthModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
            activeOpacity={1}
            onPress={() => setAuthModal(null)}
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
              <Text
                style={{ color: "#e6edf3", fontWeight: "bold", fontSize: 17, marginBottom: 4 }}
              >
                Connect {authModal?.provider.name}
              </Text>
              <Text style={{ color: "#8b949e", fontSize: 13, marginBottom: 16 }}>
                Enter your API key for this provider
              </Text>

              <Text style={{ color: "#8b949e", fontSize: 12, marginBottom: 6 }}>
                API Key
              </Text>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-..."
                placeholderTextColor="#6e7681"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
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
                onPress={handleSetAuth}
                disabled={!apiKey.trim() || saving}
                style={{
                  backgroundColor: !apiKey.trim() || saving ? "#21262d" : "#1f6feb",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#e6edf3" />
                ) : (
                  <Text style={{ color: "#e6edf3", fontWeight: "bold", fontSize: 15 }}>
                    Save & Connect
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
