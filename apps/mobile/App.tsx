import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LanguageProvider } from "./src/i18n";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { theme } from "./src/theme";

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
