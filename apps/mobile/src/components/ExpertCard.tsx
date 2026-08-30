import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import type { Expert } from "../types";

export function ExpertCard({
  expert,
  onPress,
}: {
  expert: Expert;
  onPress: () => void;
}): React.JSX.Element {
  const avatar = expert.avatar ?? expert.name.slice(0, 1).toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatar}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {expert.name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {expert.description}
        </Text>
        {expert.skills.length > 0 ? (
          <View style={styles.skills}>
            {expert.skills.slice(0, 3).map((skill) => (
              <View key={skill} style={styles.skillTag}>
                <Text style={styles.skillText} numberOfLines={1}>
                  {skill}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
  },
  skills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  skillTag: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    maxWidth: 120,
  },
  skillText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
  },
});
