import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { apiClient } from "../api/runtime";
import { expertsApi } from "../api/experts";
import { useAsyncData } from "../hooks/useAsyncData";
import { RetryBanner } from "../components/RetryBanner";
import { LoadingView } from "../components/LoadingView";
import type { RootStackParamList } from "../navigation/types";
import type { Expert } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ExpertDetail">;

/** 专家详情：GET /experts/:id，展示 systemPrompt / methodology / skills */
export function ExpertDetailScreen({ route }: Props): React.JSX.Element {
  const { t } = useI18n();
  const expertId = route.params.expertId;

  const loadExpert = useCallback(() => expertsApi.get(apiClient, expertId), [expertId]);
  const { data: expert, loading, error, reload } = useAsyncData<Expert>(loadExpert, [expertId]);

  if (loading && !expert) return <LoadingView />;
  if (error && !expert) {
    return (
      <View style={styles.container}>
        <RetryBanner error={error} onRetry={() => void reload()} retrying={loading} />
      </View>
    );
  }
  if (!expert) return <View style={styles.container} />;

  const avatar = expert.avatar ?? expert.name.slice(0, 1).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RetryBanner error={error} onRetry={() => void reload()} retrying={loading} />
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatar}</Text>
        </View>
        <Text style={styles.name}>{expert.name}</Text>
        <Text style={styles.description}>{expert.description}</Text>
        {expert.model ? (
          <Text style={styles.meta}>
            {t("experts.model")}: {expert.model}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {t("experts.source")}: {expert.source}
        </Text>
      </View>

      <Section title={t("experts.systemPrompt")}>
        <Text style={styles.sectionText}>{expert.systemPrompt}</Text>
      </Section>

      {expert.methodology ? (
        <Section title={t("experts.methodology")}>
          <Text style={styles.sectionText}>{expert.methodology}</Text>
        </Section>
      ) : null}

      <Section title={t("experts.skills")}>
        {expert.skills.length > 0 ? (
          <View style={styles.skills}>
            {expert.skills.map((skill) => (
              <View key={skill} style={styles.skillTag}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sectionText}>—</Text>
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 26,
    fontWeight: "700",
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    textAlign: "center",
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  sectionText: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  skills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  skillTag: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  skillText: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
  },
});
