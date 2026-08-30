import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../theme";
import { useI18n } from "../i18n";
import { apiClient } from "../api/runtime";
import { devicesApi, type DevicePlatform } from "../api/devices";
import { ApiError } from "../api/client";

export function PairingScreen(): React.JSX.Element {
  const { t } = useI18n();
  const navigation = useNavigation();
  const api = apiClient;

  const [pairCode, setPairCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePair(): Promise<void> {
    if (!pairCode.trim() || !deviceName.trim()) {
      setError(t("pairing.error"));
      return;
    }
    setPairing(true);
    setError(null);
    try {
      const platform: DevicePlatform = "ios";
      const result = devicesApi(api).pair(pairCode.trim().toUpperCase(), deviceName.trim(), platform);
      const resolved = await result;
      Alert.alert(t("pairing.success"), `Device ID: ${resolved.deviceId}`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "pair_code_expired_or_invalid") {
        setError(t("pairing.errorExpired"));
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || t("pairing.error"));
      }
    } finally {
      setPairing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="phone-portrait-outline" size={48} color={theme.colors.primary} />
        <Text style={styles.title}>{t("pairing.title")}</Text>
        <Text style={styles.description}>{t("pairing.desc")}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>{t("pairing.pairCode")}</Text>
        <TextInput
          style={styles.pairCodeInput}
          value={pairCode}
          onChangeText={setPairCode}
          placeholder="ABC234"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
          maxLength={6}
          editable={!pairing}
        />

        <Text style={styles.label}>{t("pairing.deviceName")}</Text>
        <TextInput
          style={styles.input}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder={t("pairing.deviceNamePlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          editable={!pairing}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, pairing && styles.buttonDisabled]}
          onPress={handlePair}
          disabled={pairing}
        >
          <Text style={styles.buttonText}>
            {pairing ? t("pairing.pairing") : t("pairing.submit")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: "600",
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  form: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  pairCodeInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    color: theme.colors.text,
    textAlign: "center",
    fontFamily: "monospace",
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text,
  },
  errorText: {
    fontSize: theme.typography.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});