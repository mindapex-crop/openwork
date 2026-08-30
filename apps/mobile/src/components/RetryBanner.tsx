import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { ApiError } from "../api/client";

/**
 * 离线容错条：请求失败时展示错误原因 + 重试按钮。
 * 网络错误（ApiError.status === 0）给出"无法连接服务器"提示。
 */
export function RetryBanner({
  error,
  onRetry,
  retrying = false,
}: {
  error: Error | null;
  onRetry: () => void;
  retrying?: boolean;
}): React.JSX.Element | null {
  const { t } = useI18n();
  if (!error) return null;

  const isNetwork = error instanceof ApiError && error.isNetworkError;
  const message = isNetwork ? t("common.offline") : error.message || t("common.error");

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
          onPress={onRetry}
          disabled={retrying}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{retrying ? t("common.loading") : t("common.retry")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  message: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.caption,
  },
  button: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: theme.typography.caption,
    fontWeight: "600",
  },
});
