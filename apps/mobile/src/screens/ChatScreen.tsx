import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { useI18n } from "../i18n";
import { theme } from "../theme";
import { apiClient } from "../api/runtime";
import { sessionsApi } from "../api/sessions";
import { MessageBubble } from "../components/MessageBubble";
import { RetryBanner } from "../components/RetryBanner";
import { EmptyState } from "../components/EmptyState";
import type { RootStackParamList } from "../navigation/types";
import type { SessionMessage } from "../types";

type ChatProps = NativeStackScreenProps<RootStackParamList, "Chat">;

function localUserMessage(sessionId: string, text: string): SessionMessage {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    info: { id, sessionID: sessionId, role: "user", time: { created: Date.now() } },
    parts: [{ id, messageID: id, sessionID: sessionId, type: "text", text }],
  };
}

/**
 * 聊天界面：消息列表 + 输入框 + 发送（走 HTTP）。
 * - 已有会话：route.params.sessionId → 拉取 GET /workspace/:id/sessions/:sid/messages
 * - 新会话：route.params 为空 → 首条消息时 POST /workspace/:id/sessions { title, prompt }
 * - 发送：POST /workspace/:id/opencode/session/:sid/prompt_async（TODO 联调，见 api/sessions.ts）
 */
export function ChatScreen({ route }: ChatProps): React.JSX.Element {
  const { t } = useI18n();
  const initialSessionId = route.params?.sessionId;
  const initialTitle = route.params?.title;

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [sendError, setSendError] = useState<Error | null>(null);
  const listRef = useRef<FlatList<SessionMessage>>(null);
  const initialTitleRef = useRef(initialTitle);

  const loadMessages = useCallback(async (sid: string) => {
    setLoadingMessages(true);
    setLoadError(null);
    try {
      const workspaceId = await sessionsApi.resolveWorkspaceId(
        apiClient,
        apiClient.getConfig().workspaceId,
      );
      const items = await sessionsApi.messages(apiClient, workspaceId, sid, { limit: 100 });
      setMessages(items);
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // 已有会话：进入即加载消息
  useEffect(() => {
    if (initialSessionId) {
      void loadMessages(initialSessionId);
    }
  }, [initialSessionId, loadMessages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const workspaceId = await sessionsApi.resolveWorkspaceId(
        apiClient,
        apiClient.getConfig().workspaceId,
      );
      let sid = sessionId;
      if (!sid) {
        // 新会话：以首条消息创建会话
        const title = initialTitleRef.current || text.slice(0, 40) || t("chat.title");
        const result = await sessionsApi.create(apiClient, workspaceId, { title, prompt: text });
        sid = result.item.id;
        setSessionId(sid);
      } else {
        // 已有会话：走 opencode prompt_async 代理（TODO 联调）
        await sessionsApi.sendMessage(apiClient, workspaceId, sid, text);
      }
      setInput("");
      setMessages((prev) => [...prev, localUserMessage(sid as string, text)]);
      // 发送后延迟拉取一次服务端消息（收到回复）
      setTimeout(() => {
        if (sid) void loadMessages(sid);
      }, 1500);
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSending(false);
    }
  }, [input, sending, sessionId, loadMessages, t]);

  const retrySend = useCallback(() => {
    setSendError(null);
    void send();
  }, [send]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <RetryBanner error={sendError} onRetry={retrySend} retrying={sending} />
      <RetryBanner error={loadError} onRetry={() => sessionId && void loadMessages(sessionId)} retrying={loadingMessages} />
      {loadingMessages && messages.length === 0 ? (
        <ActivityIndicator style={styles.topLoader} color={theme.colors.primary} />
      ) : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.info.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loadingMessages ? null : (
            <EmptyState icon="🤖" title={t("chat.empty")} />
          )
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t("chat.inputPlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={4000}
          accessibilityLabel={t("chat.inputPlaceholder")}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("chat.send")}
          onPress={send}
          disabled={sending || !input.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (sending || !input.trim()) && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topLoader: {
    marginTop: theme.spacing.md,
  },
  listContent: {
    paddingVertical: theme.spacing.sm,
    flexGrow: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    fontSize: theme.typography.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
});
