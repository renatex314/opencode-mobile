import React from "react";
import { TouchableOpacity, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useServer } from "../context/ServerContext";
import { Ionicons } from "@expo/vector-icons";
import ConnectScreen from "../screens/ConnectScreen";
import TabNavigator from "./TabNavigator";
import ChatScreen from "../screens/ChatScreen";
import CodeEditorScreen from "../screens/CodeEditorScreen";
import FileExplorerScreen from "../screens/FileExplorerScreen";
import SessionDiffScreen from "../screens/SessionDiffScreen";
import SessionTodosScreen from "../screens/SessionTodosScreen";

export type RootStackParamList = {
  Connect: undefined;
  Main: undefined;
  Chat: { sessionId: string; sessionTitle?: string };
  CodeEditor: { path: string; content?: string };
  FileExplorer: undefined;
  SessionDiff: { sessionId: string };
  SessionTodos: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { connected } = useServer();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#161b22" },
        headerTintColor: "#e6edf3",
        headerTitleStyle: { color: "#e6edf3", fontWeight: "600" },
        contentStyle: { backgroundColor: "#0d1117" },
        animation: "slide_from_right",
      }}
    >
      {!connected ? (
        <Stack.Screen
          name="Connect"
          component={ConnectScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route, navigation }) => ({
              title: (route.params as { sessionTitle?: string }).sessionTitle || "Chat",
              headerBackTitle: "Back",
              headerRight: () => {
                const sessionId = (route.params as { sessionId: string }).sessionId;
                return (
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("SessionTodos", { sessionId })}
                      style={{ padding: 6 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="list-outline" size={22} color="#8b949e" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("SessionDiff", { sessionId })}
                      style={{ padding: 6 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="git-compare-outline" size={22} color="#8b949e" />
                    </TouchableOpacity>
                  </View>
                );
              },
            })}
          />
          <Stack.Screen
            name="CodeEditor"
            component={CodeEditorScreen}
            options={({ route }) => ({
              title: (route.params as { path: string }).path.split("/").pop() || "Editor",
              headerBackTitle: "Back",
            })}
          />
          <Stack.Screen
            name="FileExplorer"
            component={FileExplorerScreen}
            options={{ title: "Files" }}
          />
          <Stack.Screen
            name="SessionDiff"
            component={SessionDiffScreen}
            options={{ title: "Changes" }}
          />
          <Stack.Screen
            name="SessionTodos"
            component={SessionTodosScreen}
            options={{ title: "Todos" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
