import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { EmptyState } from "../components/EmptyState";
import { LoadingView } from "../components/LoadingView";
import { RetryBanner } from "../components/RetryBanner";
import { useAsyncData } from "../hooks/useAsyncData";
import { apiClient } from "../api/runtime";
import { automationsApi } from "../api/automations";
import { formatRelativeTime } from "../utils/messages";
import type { Automation } from "../types";

function AutomationRow({
  automation,
  onToggle,
}: {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
}): React.JSX.Element {
  const { t } = useI18n();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.name, !automation.enabled && styles.nameDisabled]} numberOfLines={1}>
          {automation.name}
        </Text>
        <Switch
          value={automation.enabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
          thumbColor={automation.enabled ? theme.colors.primary : theme.colors.textMuted}
        />
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {automation.description}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.trigger} numberOfLines={1}>
          {automation.trigger}
        </Text>
        <Text style={styles.status}>
          {automation.enabled ? t("automations.enabled") : t("automations.disabled")}
        </Text>
      </View>
      <Text style={styles.meta}>{formatRelativeTime(automation.updatedAt)}</Text>
    </View>
  );
}

export function AutomationsScreen(): React.JSX.Element {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsyncData<Automation[]>(
    () => automationsApi.list(apiClient),
    [],
  );
  const [items, setItems] = useState<Automation[]>([]);

  React.useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, enabled } : item)));
    try {
      const updated = await automationsApi.toggle(apiClient, id, enabled);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !enabled } : item)));
    }
  }, []);

  if (loading && !data) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <RetryBanner error={error} onRetry={() => void reload()} />
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AutomationRow automation={item} onToggle={(enabled) => toggle(item.id, enabled)} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState icon="⚡" title={t("automations.empty")} />}
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
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  nameDisabled: {
    color: theme.colors.textMuted,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  trigger: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
  },
  status: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.small,
    fontWeight: "600",
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
  },
});
