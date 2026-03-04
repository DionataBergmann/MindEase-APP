import {
  Pressable,
  StyleSheet,
  type PressableProps,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type ButtonProps = PressableProps & {
  variant?: 'default' | 'outline' | 'link' | 'destructive';
  loading?: boolean;
  children: React.ReactNode;
};

export function Button({
  style,
  variant = 'default',
  loading = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const variantStyles = {
    default: {
      backgroundColor: colors.primary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    link: {
      backgroundColor: 'transparent',
    },
    destructive: {
      backgroundColor: colors.destructive,
    },
  };

  const textColor =
    variant === 'default' || variant === 'destructive'
      ? colors.primaryForeground
      : colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <ThemedText
          style={[
            styles.text,
            variant === 'link' && styles.textLink,
            { color: textColor },
          ]}
        >
          {children}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: '600', fontSize: 16 },
  textLink: { fontWeight: '500' },
});
