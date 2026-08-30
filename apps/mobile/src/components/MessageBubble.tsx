import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import { extractMessageText, isUserMessage } from "../utils/messages";
import type { SessionMessage } from "../types";

export function MessageBubble({ message }: { message: SessionMessage }): React.JSX.Element {
  const user = isUserMessage(message);
  const text = extractMessageText(message);
  const time = message.info.time?.created ? new Date(message.info.time.created) : null;

  return (
    <View style={[styles.row, user ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, user ? styles.bubbleUser : styles.bubbleAssistant]}>
        {text ? (
          <Text style={[styles.text, user && styles.textUser]}>{text}</Text>
        ) : (
          <Text style={styles.emptyText}>…</Text>
        )}
        {time ? (
          <Text style={styles.time}>
            {String(time.getHours()).padStart(2, "0")}:{String(time.getMinutes()).padStart(2, "0")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAssistant: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  bubbleUser: {
    backgroundColor: theme.colors.chatUserBubble,
    borderBottomRightRadius: theme.radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: theme.colors.chatAssistantBubble,
    borderBottomLeftRadius: theme.radius.sm,
  },
  text: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    lineHeight: 21,
  },
  textUser: {
    color: "#FFFFFF",
  },
  emptyText: {
    color: theme.colors.textMuted,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
    marginTop: 2,
    alignSelf: "flex-end",
  },
});
