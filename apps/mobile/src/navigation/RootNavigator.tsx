import React from "react";
import { NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { AssistantScreen } from "../screens/AssistantScreen";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { AutomationsScreen } from "../screens/AutomationsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { ExpertsScreen } from "../screens/ExpertsScreen";
import { ExpertDetailScreen } from "../screens/ExpertDetailScreen";
import { PairingScreen } from "../screens/PairingScreen";
import { ModelSelectionScreen } from "../screens/ModelSelectionScreen";
import type { RootStackParamList, TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: NavTheme = {
  dark: true,
  colors: {
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "600" },
    heavy: { fontFamily: "System", fontWeight: "700" },
  },
};

function TabIcon({
  name,
  focused,
  icon,
  iconOutline,
}: {
  name: string;
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Ionicons
      name={focused ? icon : iconOutline}
      size={22}
      color={focused ? theme.colors.primary : theme.colors.textMuted}
      accessibilityLabel={name}
    />
  );
}

function MainTabs(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.text, fontWeight: "600" },
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Home"
        component={AssistantScreen}
        options={{
          title: t("nav.assistant"),
          tabBarLabel: t("nav.assistant"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={t("nav.assistant")} focused={focused} icon="chatbubble" iconOutline="chatbubble-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: t("nav.projects"),
          tabBarLabel: t("nav.projects"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={t("nav.projects")} focused={focused} icon="folder" iconOutline="folder-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="Automations"
        component={AutomationsScreen}
        options={{
          title: t("nav.automations"),
          tabBarLabel: t("nav.automations"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={t("nav.automations")} focused={focused} icon="flash" iconOutline="flash-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t("nav.settings"),
          tabBarLabel: t("nav.settings"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={t("nav.settings")} focused={focused} icon="settings" iconOutline="settings-outline" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text, fontWeight: "600" },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Experts"
          component={ExpertsScreen}
          options={{ title: t("nav.experts") }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({ title: route.params?.title ?? t("chat.title") })}
        />
        <Stack.Screen
          name="ExpertDetail"
          component={ExpertDetailScreen}
          options={{ title: t("experts.detail") }}
        />
        <Stack.Screen
          name="Pairing"
          component={PairingScreen}
          options={{ title: t("pairing.title") }}
        />
        <Stack.Screen
          name="ModelSelection"
          component={ModelSelectionScreen}
          options={{ title: t("models.title") }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
