import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Experts: undefined;
  Chat: { sessionId?: string; title?: string; model?: string } | undefined;
  ExpertDetail: { expertId: string };
  Pairing: undefined;
  ModelSelection: { selectedModel?: string } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Projects: undefined;
  Automations: undefined;
  Settings: undefined;
};
