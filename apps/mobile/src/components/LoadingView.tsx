import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { theme } from "../theme";

export function LoadingView(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl * 2,
  },
});
