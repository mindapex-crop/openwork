import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { EmptyState } from "../components/EmptyState";
import { LoadingView } from "../components/LoadingView";
import { RetryBanner } from "../components/RetryBanner";
import { useAsyncData } from "../hooks/useAsyncData";
import { apiClient } from "../api/runtime";
import { projectsApi } from "../api/projects";
import { formatRelativeTime } from "../utils/messages";
import type { Project } from "../types";

function ProjectCard({ project }: { project: Project }): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={1}>
          {project.name}
        </Text>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: project.status === "active" ? theme.colors.success : theme.colors.textMuted },
          ]}
        />
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {project.description}
      </Text>
      <Text style={styles.meta}>{formatRelativeTime(project.updatedAt)}</Text>
    </View>
  );
}

export function ProjectsScreen(): React.JSX.Element {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsyncData<Project[]>(
    () => projectsApi.list(apiClient),
    [],
  );

  if (loading && !data) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <RetryBanner error={error} onRetry={() => void reload()} />
      ) : null}
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProjectCard project={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState icon="📁" title={t("projects.empty")} />}
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
  },
});
