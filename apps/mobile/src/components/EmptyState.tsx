import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}): React.JSX.Element {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    textAlign: "center",
  },
});
