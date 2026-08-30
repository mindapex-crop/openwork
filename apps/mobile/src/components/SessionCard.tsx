import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import { formatRelativeTime, sessionActivityTime } from "../utils/messages";
import type { SessionInfo } from "../types";

export function SessionCard({
  session,
  subtitle,
  onPress,
}: {
  session: SessionInfo;
  subtitle?: string;
  onPress: () => void;
}): React.JSX.Element {
  const time = sessionActivityTime(session);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title || session.id}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {time ? (
        <Text style={styles.time} numberOfLines={1}>
          {formatRelativeTime(time)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
  },
});
