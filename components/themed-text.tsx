import React from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { useFontScale } from "@/contexts/PreferencesContext";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

const baseStyles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 24 },
  defaultSemiBold: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  title: { fontSize: 32, fontWeight: "bold", lineHeight: 32 },
  subtitle: { fontSize: 20, fontWeight: "bold" },
  link: { lineHeight: 30, fontSize: 16 },
});

function scaleStyle(style: TextStyle | undefined, fontScale: number): TextStyle | undefined {
  if (!style || fontScale === 1) return style;
  const flat = StyleSheet.flatten(style) as TextStyle;
  if (!flat || typeof flat.fontSize !== "number") return style;
  return {
    ...flat,
    fontSize: flat.fontSize * fontScale,
    lineHeight: typeof flat.lineHeight === "number" ? flat.lineHeight * fontScale : flat.lineHeight,
  };
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  const primaryColor = useThemeColor({}, "primary");
  const color = type === "link" ? primaryColor : textColor;
  const fontScale = useFontScale();

  const base =
    type === "default"
      ? baseStyles.default
      : type === "title"
        ? baseStyles.title
        : type === "defaultSemiBold"
          ? baseStyles.defaultSemiBold
          : type === "subtitle"
            ? baseStyles.subtitle
            : type === "link"
              ? baseStyles.link
              : undefined;

  const scaledBase = base
    ? {
        ...base,
        fontSize: (base.fontSize ?? 16) * fontScale,
        lineHeight: ("lineHeight" in base ? base.lineHeight : base.fontSize ?? 16) * fontScale,
      }
    : undefined;

  const scaledStyle = Array.isArray(style)
    ? style.map((s) => scaleStyle(s as TextStyle, fontScale))
    : scaleStyle(style as TextStyle, fontScale);

  return <Text style={[{ color }, scaledBase, scaledStyle]} {...rest} />;
}
