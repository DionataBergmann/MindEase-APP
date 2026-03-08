import React from "react";
import { View, StyleSheet, type ViewProps } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

export type ProgressProps = ViewProps & {
  value?: number;
  max?: number;
};

export const Progress = React.forwardRef<View, ProgressProps>(
  ({ style, value = 0, max = 100, ...props }, ref) => {
    const scheme = useColorScheme() ?? "light";
    const colors = Colors[scheme];
    const pct = Math.min(max, Math.max(0, value));
    const widthPct = max > 0 ? (pct / max) * 100 : 0;

    return (
      <View
        ref={ref}
        style={[styles.track, { backgroundColor: colors.muted ?? colors.secondary }, style]}
        {...props}
      >
        <View style={[styles.fill, { backgroundColor: colors.primary, width: `${widthPct}%` }]} />
      </View>
    );
  }
);
Progress.displayName = "Progress";

const styles = StyleSheet.create({
  track: {
    height: 8,
    width: "100%",
    borderRadius: 9999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 9999,
  },
});
