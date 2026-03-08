import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import React, { forwardRef } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

export type InputProps = TextInputProps;

function withOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const PLACEHOLDER_OPACITY = 0.55;

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { style, placeholderTextColor, ...rest },
  ref
) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const placeholderColor =
    placeholderTextColor ?? withOpacity(colors.mutedForeground, PLACEHOLDER_OPACITY);

  return (
    <TextInput
      ref={ref}
      style={[
        styles.input,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          color: colors.foreground,
        },
        style,
      ]}
      placeholderTextColor={placeholderColor}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
