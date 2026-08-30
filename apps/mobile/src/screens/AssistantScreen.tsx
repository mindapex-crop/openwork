import React, { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { apiClient } from "../api/runtime";
import { sessionsApi } from "../api/sessions";
import { useAsyncData } from "../hooks/useAsyncData";
import { SessionCard } from "../components/SessionCard";
import { RetryBanner } from "../components/RetryBanner";
import { LoadingView } from "../components/LoadingView";
import { EmptyState } from "../components/EmptyState";
import type { RootStackParamList } from "../navigation/types";
import type { SessionInfo } from "../types";

type AssistantNav = NativeStackNavigationProp<RootStackParamList, "Tabs">;

/**
 * 助理页：会话列表（GET /workspace/:id/sessions）。
 * 进入聊天：navigation.navigate("Chat", { sessionId })。
 */
export function AssistantScreen(): React.JSX.Element {
  const { t } = useI18n();
  const navigation = useNavigation<AssistantNav>();

  const loadSessions = useCallback(async (): Promise<SessionInfo[]> => {
    const workspaceId = await sessionsApi.resolveWorkspaceId(
      apiClient,
      apiClient.getConfig().workspaceId,
    );
    return sessionsApi.list(apiClient, workspaceId, { limit: 50 });
  }, []);

  const { data: sessions, loading, error, reload } = useAsyncData<SessionInfo[]>(loadSessions, []);

  const openChat = useCallback(
    (session?: SessionInfo) => {
      navigation.navigate("Chat", session ? { sessionId: session.id, title: session.title ?? undefined } : undefined);
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <RetryBanner error={error} onRetry={() => void reload()} retrying={loading} />
      {loading && !sessions ? (
        <LoadingView />
      ) : !sessions || sessions.length === 0 ? (
        <EmptyState icon="💬" title={t("home.empty")} hint={t("home.emptyHint")} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionCard session={item} onPress={() => openChat(item)} />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      )}
    </View>
  );
}

/** 右上角"新建会话"按钮（HeaderRight 由 Tab navigator 注入） */
export function NewSessionButton(): React.JSX.Element {
  const { t } = useI18n();
  const navigation = useNavigation<AssistantNav>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("home.newSession")}
      onPress={() => navigation.navigate("Chat", undefined)}
      hitSlop={8}
      style={({ pressed }) => [styles.newButton, pressed && styles.newButtonPressed]}
    >
      <Ionicons name="add" size={26} color={theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingVertical: theme.spacing.sm,
  },
  expertsEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  expertsEntryPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  expertsEntryText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  newButton: {
    marginRight: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  newButtonPressed: {
    opacity: 0.6,
  },
});
