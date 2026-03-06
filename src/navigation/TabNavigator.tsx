import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import SessionsScreen from "../screens/SessionsScreen";
import ShellScreen from "../screens/ShellScreen";
import ProvidersScreen from "../screens/ProvidersScreen";
import AgentsScreen from "../screens/AgentsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import type { RootStackParamList } from "./RootNavigator";

export type TabParamList = {
  Sessions: undefined;
  Shell: undefined;
  Providers: undefined;
  Agents: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { focused: IoniconsName; unfocused: IoniconsName }> = {
  Sessions: { focused: "chatbubbles", unfocused: "chatbubbles-outline" },
  Shell: { focused: "terminal", unfocused: "terminal-outline" },
  Providers: { focused: "server", unfocused: "server-outline" },
  Agents: { focused: "hardware-chip", unfocused: "hardware-chip-outline" },
  Settings: { focused: "settings", unfocused: "settings-outline" },
};

function FilesHeaderButton() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TouchableOpacity
      onPress={() => nav.navigate("FileExplorer")}
      style={{ marginRight: 14, padding: 2 }}
    >
      <Ionicons name="folder-outline" size={22} color="#58a6ff" />
    </TouchableOpacity>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name] ?? { focused: "ellipse", unfocused: "ellipse-outline" };
          return (
            <Ionicons
              name={focused ? icons.focused : icons.unfocused}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: "#58a6ff",
        tabBarInactiveTintColor: "#6e7681",
        tabBarStyle: {
          backgroundColor: "#161b22",
          borderTopColor: "#30363d",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        headerStyle: { backgroundColor: "#161b22" },
        headerTintColor: "#e6edf3",
        headerTitleStyle: { color: "#e6edf3", fontWeight: "600" },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{
          title: "Sessions",
          headerTitle: "OpenCode",
          headerRight: () => <FilesHeaderButton />,
        }}
      />
      <Tab.Screen
        name="Shell"
        component={ShellScreen}
        options={{ title: "Shell" }}
      />
      <Tab.Screen
        name="Providers"
        component={ProvidersScreen}
        options={{ title: "Providers" }}
      />
      <Tab.Screen
        name="Agents"
        component={AgentsScreen}
        options={{ title: "Agents" }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
    </Tab.Navigator>
  );
}
