import React from "react";
import { Pressable, View, StyleSheet, type PressableProps, ActivityIndicator } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";

function isTextOnly(children: React.ReactNode): boolean {
  const c = React.Children.toArray(children);
  if (c.length !== 1) return c.length === 0;
  const child = c[0];
  return typeof child === "string" || typeof child === "number";
}

export type ButtonProps = PressableProps & {
  variant?: "default" | "outline" | "link" | "destructive";
  loading?: boolean;
  children: React.ReactNode;
};

export function Button({
  style,
  variant = "default",
  loading = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const variantStyles = {
    default: {
      backgroundColor: colors.primary,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    link: {
      backgroundColor: "transparent",
    },
    destructive: {
      backgroundColor: colors.destructive,
    },
  };

  const textColor =
    variant === "default"
      ? colors.primaryForeground
      : variant === "destructive"
        ? colors.destructiveForeground
        : colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : isTextOnly(children) ? (
        <ThemedText
          style={[styles.text, variant === "link" && styles.textLink, { color: textColor }]}
        >
          {children}
        </ThemedText>
      ) : (
        <View style={styles.contentRow}>{children}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  contentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: "600", fontSize: 16 },
  textLink: { fontWeight: "500" },
});
