import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

import { useI18n, LANGUAGE_LABELS, type Language } from "../i18n";
import { theme } from "../theme";
import { DEFAULT_CONFIG, type AppConfig } from "../config";
import { updateApiConfig } from "../api/runtime";

type LanguageChoice = Language | "system";

/**
 * 设置页：
 * - 语言：跟随系统 / 简体中文 / English（默认跟随设备语言）
 * - 服务器：serverUrl / bearerToken / workspaceId（保存后全局生效）
 */
export function SettingsScreen(): React.JSX.Element {
  const { t, lang, setLang, resetToSystem } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [choice, setChoice] = useState<LanguageChoice>("system");

  const [serverUrl, setServerUrl] = useState(DEFAULT_CONFIG.serverUrl);
  const [bearerToken, setBearerToken] = useState(DEFAULT_CONFIG.bearerToken);
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_CONFIG.workspaceId);

  const selectLanguage = useCallback(
    (next: LanguageChoice) => {
      setChoice(next);
      if (next === "system") {
        resetToSystem();
      } else {
        setLang(next);
      }
    },
    [resetToSystem, setLang],
  );

  const saveServer = useCallback(() => {
    const patch: Partial<AppConfig> = {};
    const trimmedUrl = serverUrl.trim().replace(/\/+$/, "");
    if (trimmedUrl) patch.serverUrl = trimmedUrl;
    patch.bearerToken = bearerToken.trim();
    patch.workspaceId = workspaceId.trim();
    updateApiConfig(patch);
    Alert.alert(t("settings.title"), t("settings.saved"));
  }, [serverUrl, bearerToken, workspaceId, t]);

  const languageOptions: Array<{ value: LanguageChoice; label: string }> = [
    { value: "system", label: t("settings.languageSystem") },
    { value: "zh", label: LANGUAGE_LABELS.zh },
    { value: "en", label: LANGUAGE_LABELS.en },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>{t("settings.language")}</SectionTitle>
        <View style={styles.group}>
          {languageOptions.map((option) => {
            const active = option.value === choice;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => selectLanguage(option.value)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{option.label}</Text>
                {active ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}
          <Text style={styles.rowHint}>{t("nav.assistant")}/{t("nav.projects")}/{t("nav.automations")} · {t("settings.languageSystem")}</Text>
        </View>

        <SectionTitle>{t("settings.serverUrl")}</SectionTitle>
        <View style={styles.group}>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://127.0.0.1:8787"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel={t("settings.serverUrl")}
          />
          <TextInput
            style={styles.input}
            value={bearerToken}
            onChangeText={setBearerToken}
            placeholder={t("settings.token")}
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel={t("settings.token")}
          />
          <TextInput
            style={styles.input}
            value={workspaceId}
            onChangeText={setWorkspaceId}
            placeholder={t("settings.workspaceId")}
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("settings.workspaceId")}
          />
          <Pressable
            accessibilityRole="button"
            onPress={saveServer}
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          >
            <Text style={styles.saveButtonText}>{t("settings.save")}</Text>
          </Pressable>
        </View>

        <SectionTitle>{t("pairing.title")}</SectionTitle>
        <View style={styles.group}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("Pairing")}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Ionicons name="phone-portrait-outline" size={22} color={theme.colors.primary} />
            <Text style={styles.rowLabel}>{t("pairing.title")}</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.about}>{t("settings.about")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  rowLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
  },
  rowLabelActive: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  rowHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
    paddingHorizontal: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: theme.typography.body,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: theme.spacing.xs,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  about: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.small,
    textAlign: "center",
    marginTop: theme.spacing.xl * 2,
  },
});
