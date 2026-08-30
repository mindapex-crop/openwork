import React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { LoadingView } from "../components/LoadingView";
import { RetryBanner } from "../components/RetryBanner";
import { useAsyncData } from "../hooks/useAsyncData";
import { apiClient } from "../api/runtime";
import { modelsApi, type AgentModel } from "../api/models";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ModelSelection">;

export function ModelSelectionScreen({ route, navigation }: Props): React.JSX.Element {
  const { t } = useI18n();
  const selectedModel = route.params?.selectedModel;
  const { data, loading, error, reload } = useAsyncData<AgentModel[]>(
    async () => {
      const agents = await modelsApi.listAgents(apiClient);
      const availableAgent = agents.find((a) => a.available) ?? agents[0];
      if (!availableAgent) return [];
      return modelsApi.listModels(apiClient, availableAgent.agentId);
    },
    [],
  );

  function handleSelect(model: string) {
    navigation.navigate("Tabs", {
      screen: "Home",
    });
  }

  if (loading && !data) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t("models.select_title")}</Text>
      {error ? (
        <RetryBanner error={error} onRetry={() => void reload()} />
      ) : null}
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedModel;
          return (
            <Pressable
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => handleSelect(item.id)}
            >
              <View style={styles.rowContent}>
                <Text style={[styles.rowName, isSelected && styles.rowNameSelected]} numberOfLines={1}>
                  {item.name ?? item.id}
                </Text>
                {item.provider ? (
                  <Text style={styles.rowProvider}>{item.provider}</Text>
                ) : null}
              </View>
              {isSelected ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : null}
            </Pressable>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("models.empty")}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    fontSize: theme.typography.heading,
    fontWeight: "600",
    color: theme.colors.text,
    padding: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: theme.typography.body,
    color: theme.colors.text,
    fontWeight: "500",
  },
  rowNameSelected: {
    color: theme.colors.primary,
  },
  rowProvider: {
    fontSize: theme.typography.small,
    color: theme.colors.textMuted,
  },
  checkmark: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: "700",
    marginLeft: theme.spacing.sm,
  },
  empty: {
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
  },
});
