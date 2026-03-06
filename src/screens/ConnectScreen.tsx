import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";

export default function ConnectScreen() {
  const { connect, connecting, error } = useServer();
  const [serverUrl, setServerUrl] = useState("http://192.168.1.1:4096");
  const [useAuth, setUseAuth] = useState(false);
  const [username, setUsername] = useState("opencode");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleConnect = async () => {
    const auth = useAuth && password ? { username, password } : undefined;
    await connect(serverUrl.trim(), auth);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-6 py-8">
            {/* Logo / Header */}
            <View className="items-center mb-10">
              <View className="w-20 h-20 rounded-2xl bg-bg-secondary border border-border items-center justify-center mb-4">
                <Ionicons name="code-slash" size={42} color="#58a6ff" />
              </View>
              <Text className="text-3xl font-bold text-text-primary">OpenCode</Text>
              <Text className="text-text-secondary mt-1 text-base">
                Mobile Client
              </Text>
            </View>

            {/* Connection Card */}
            <View className="bg-bg-secondary rounded-xl border border-border p-5 mb-4">
              <Text className="text-text-secondary text-xs font-semibold uppercase tracking-widest mb-3">
                Server URL
              </Text>
              <View className="flex-row items-center bg-bg-tertiary rounded-lg border border-border px-3 mb-1">
                <Ionicons name="globe-outline" size={18} color="#8b949e" />
                <TextInput
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  className="flex-1 text-text-primary text-base py-3 ml-2"
                  placeholder="http://192.168.x.x:4096"
                  placeholderTextColor="#6e7681"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <Text className="text-text-muted text-xs mt-1">
                Run{" "}
                <Text className="text-accent-blue font-mono">opencode serve</Text>{" "}
                on the host machine
              </Text>
            </View>

            {/* Auth toggle */}
            <View className="bg-bg-secondary rounded-xl border border-border p-5 mb-6">
              <View className="flex-row items-center justify-between mb-1">
                <View>
                  <Text className="text-text-primary font-semibold">Authentication</Text>
                  <Text className="text-text-muted text-xs mt-0.5">
                    Enable if OPENCODE_SERVER_PASSWORD is set
                  </Text>
                </View>
                <Switch
                  value={useAuth}
                  onValueChange={setUseAuth}
                  trackColor={{ false: "#30363d", true: "#1f6feb" }}
                  thumbColor={useAuth ? "#58a6ff" : "#8b949e"}
                />
              </View>

              {useAuth && (
                <View className="mt-4 space-y-3">
                  <View>
                    <Text className="text-text-secondary text-xs mb-1.5">Username</Text>
                    <TextInput
                      value={username}
                      onChangeText={setUsername}
                      className="bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 text-text-primary text-base"
                      placeholder="opencode"
                      placeholderTextColor="#6e7681"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View>
                    <Text className="text-text-secondary text-xs mb-1.5">Password</Text>
                    <View className="flex-row items-center bg-bg-tertiary border border-border rounded-lg px-3">
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        className="flex-1 py-2.5 text-text-primary text-base"
                        placeholder="••••••••"
                        placeholderTextColor="#6e7681"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setShowPassword((p) => !p)}>
                        <Ionicons
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="#8b949e"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Error */}
            {error && (
              <View className="bg-accent-red/10 border border-accent-red/40 rounded-lg px-4 py-3 mb-4 flex-row items-center">
                <Ionicons name="alert-circle-outline" size={18} color="#f85149" />
                <Text className="text-accent-red ml-2 text-sm flex-1">{error}</Text>
              </View>
            )}

            {/* Connect Button */}
            <TouchableOpacity
              onPress={handleConnect}
              disabled={connecting || !serverUrl.trim()}
              className={`rounded-xl py-4 items-center flex-row justify-center ${
                connecting || !serverUrl.trim()
                  ? "bg-bg-tertiary"
                  : "bg-accent-blue"
              }`}
              activeOpacity={0.8}
            >
              {connecting ? (
                <ActivityIndicator color="#e6edf3" />
              ) : (
                <>
                  <Ionicons name="link" size={20} color="#0d1117" />
                  <Text className="text-bg-primary font-bold text-base ml-2">
                    Connect
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Quick presets */}
            <View className="mt-6">
              <Text className="text-text-muted text-xs mb-2 text-center">Quick connect</Text>
              <View className="flex-row justify-center gap-2">
                {["localhost:4096", "localhost:3000"].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => setServerUrl(`http://${preset}`)}
                    className="bg-bg-tertiary border border-border rounded-lg px-3 py-1.5"
                  >
                    <Text className="text-text-secondary text-xs font-mono">{preset}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
