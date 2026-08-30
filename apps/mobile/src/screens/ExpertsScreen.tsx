import React, { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { apiClient } from "../api/runtime";
import { expertsApi } from "../api/experts";
import { useAsyncData } from "../hooks/useAsyncData";
import { ExpertCard } from "../components/ExpertCard";
import { RetryBanner } from "../components/RetryBanner";
import { LoadingView } from "../components/LoadingView";
import { EmptyState } from "../components/EmptyState";
import type { RootStackParamList } from "../navigation/types";
import type { Expert } from "../types";

type ExpertsNav = NativeStackNavigationProp<RootStackParamList, "Experts">;

/** 专家页：GET /experts 列表（卡片：name/description/avatar） */
export function ExpertsScreen(): React.JSX.Element {
  const { t } = useI18n();
  const navigation = useNavigation<ExpertsNav>();

  const loadExperts = useCallback(() => expertsApi.list(apiClient), []);
  const { data: experts, loading, error, reload } = useAsyncData<Expert[]>(loadExperts, []);

  return (
    <View style={styles.container}>
      <RetryBanner error={error} onRetry={() => void reload()} retrying={loading} />
      {loading && !experts ? (
        <LoadingView />
      ) : !experts || experts.length === 0 ? (
        <EmptyState icon="🎓" title={t("experts.empty")} />
      ) : (
        <FlatList
          data={experts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpertCard
              expert={item}
              onPress={() => navigation.navigate("ExpertDetail", { expertId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      )}
    </View>
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
});
