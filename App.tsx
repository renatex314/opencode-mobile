import "react-native-gesture-handler";
import "./global.css";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ServerProvider } from "./src/context/ServerContext";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ServerProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor="#0d1117" />
            <RootNavigator />
          </NavigationContainer>
        </ServerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
