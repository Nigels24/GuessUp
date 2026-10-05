/**
 * Building blocks for the student screens, styled after the prototype's
 * .logo-mark, .field, .input, .btn-primary, .error-text, .demo-chip, .avatar,
 * .pill, .topbar-s and .empty.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { initials, tint } from '../lib/format';
import { colors } from '../theme';

export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size * 0.3 },
      ]}
    >
      <Text style={[styles.logoText, { fontSize: size * 0.53 }]}>?</Text>
    </View>
  );
}

export function Field({
  label,
  right,
  ...input
}: TextInputProps & { label: string; right?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor="#A9A5C4"
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[
            styles.input,
            focused && styles.inputFocused,
            right ? { paddingRight: 54 } : null,
          ]}
        />
        {right ? <View style={styles.inputRight}>{right}</View> : null}
      </View>
    </View>
  );
}

/** A Field for passwords, with an eye button that shows or hides the text. */
export function PasswordField(
  props: Omit<TextInputProps, 'secureTextEntry'> & { label: string },
) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      secureTextEntry={!visible}
      right={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          style={styles.eye}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.muted}
          />
        </Pressable>
      }
    />
  );
}

export function ErrorText({ children }: { children: string }) {
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

/**
 * Primary button with a loading state. After a few seconds of loading it
 * explains the wait, since a sleeping Render free-tier server needs ~50s.
 */
export function PrimaryButton({
  title,
  loadingTitle,
  loading,
  onPress,
}: {
  title: string;
  loadingTitle: string;
  loading: boolean;
  onPress: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonLoading,
        ]}
      >
        {loading && (
          <ActivityIndicator color={colors.white} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.buttonText}>{loading ? loadingTitle : title}</Text>
      </Pressable>
      {slow && (
        <Text style={styles.slow}>
          Waking up the server — the first request can take up to a minute.
        </Text>
      )}
    </View>
  );
}

export function DemoChip({
  email,
  password,
  onPress,
}: {
  email: string;
  password: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.demo} onPress={onPress} accessibilityRole="button">
      <Text style={styles.demoText}>
        🧪 <Text style={styles.bold}>Demo account:</Text> {email} / {password}{' '}
        <Text style={{ color: colors.muted }}>(tap to fill)</Text>
      </Text>
    </Pressable>
  );
}

/** A short message (the prototype's toast): a toast on Android, an alert elsewhere. */
export function showToast(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}

/**
 * The prototype's .btn in its primary, ok (green) and ghost styles. Unlike
 * PrimaryButton it has no slow-server note, for actions inside a screen.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  small = false,
  style,
}: {
  title: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'ok' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: object;
}) {
  const ghost = variant === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ok' && styles.btnOk,
        ghost && styles.btnGhost,
        pressed && !ghost && styles.buttonPressed,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={ghost ? colors.brand : colors.white}
          style={{ marginRight: 8 }}
        />
      )}
      <Text
        style={[
          styles.btnText,
          small && styles.btnTextSmall,
          { color: ghost ? colors.ink2 : colors.white },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * The student's profile photo, or their initials on a brand square (the
 * prototype's .avatar / .avatar-lg) when there is none or it cannot load.
 * Every avatar in the app goes through here.
 */
export function Avatar({
  name,
  uri,
  size = 44,
  color,
  style,
}: {
  name: string | undefined;
  /** The photo (avatarUrl from the API); null or missing shows the initials. */
  uri?: string | null;
  size?: number;
  /** Background instead of the brand color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = uri && failed !== uri ? uri : null;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 3.1 },
        color ? { backgroundColor: color } : null,
        style,
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.avatarPhoto}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setFailed(photo)}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.39 }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/** The prototype's .pill; `color` gives a level pill (tinted background, colored text). */
export function Pill({
  children,
  tone = 'gray',
  color,
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'brand' | 'ok';
  color?: string;
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'brand' ? styles.pillBrand : tone === 'ok' ? styles.pillOk : styles.pillGray,
        color ? { backgroundColor: tint(color, '22') } : null,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          {
            color:
              color ??
              (tone === 'brand' ? colors.brandDark : tone === 'ok' ? colors.okDark : colors.grayPillText),
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/** The prototype's .card: a white rounded panel with the soft shadow. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The prototype's .section-title: a heading with optional text or a link on the right. */
export function SectionTitle({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {typeof right === 'string' ? <Text style={styles.sectionMeta}>{right}</Text> : right}
    </View>
  );
}

/** Screen title row (the prototype's .topbar-s). */
export function TopBar({ title }: { title: string }) {
  return (
    <View style={styles.topbar}>
      <Text style={styles.topbarTitle}>{title}</Text>
    </View>
  );
}

/** Centered spinner for a screen's first load. */
export function LoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

/** A failed load: the message and a retry button. */
export function ErrorView({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={styles.errorViewText}>{message}</Text>
      <View style={styles.retry}>
        <PrimaryButton
          title="Try again"
          loadingTitle="Loading…"
          loading={retrying}
          onPress={onRetry}
        />
      </View>
    </View>
  );
}

/** The prototype's .empty block. */
export function EmptyState({ icon, children }: { icon: string; children: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  logo: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    // The prototype's solid "0 5px 0" shadow under the mark.
    borderBottomWidth: 5,
    borderBottomColor: colors.accentShadow,
  },
  logoText: { fontWeight: '800', color: colors.ink },
  field: { marginBottom: 14 },
  label: {
    fontWeight: '800',
    fontSize: 13,
    color: colors.ink2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.brand },
  inputRight: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eye: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.bad,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 18,
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 13,
    borderBottomWidth: 4,
    borderBottomColor: colors.brandDark,
  },
  buttonPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  buttonLoading: { opacity: 0.8 },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  slow: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: colors.muted,
  },
  demo: {
    marginTop: 14,
    backgroundColor: colors.warnSoft,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.warnBorder,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  demoText: { fontSize: 13, color: colors.ink },
  bold: { fontWeight: '800' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  btnPrimary: {
    backgroundColor: colors.brand,
    borderBottomWidth: 4,
    borderBottomColor: colors.brandDark,
  },
  btnOk: {
    backgroundColor: colors.ok,
    borderBottomWidth: 4,
    borderBottomColor: colors.okDark,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.line,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '800', fontSize: 15 },
  btnTextSmall: { fontSize: 13 },
  avatar: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontWeight: '800' },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pillGray: { backgroundColor: colors.grayPill },
  pillBrand: { backgroundColor: colors.brandSoft },
  pillOk: { backgroundColor: colors.okSoft },
  pillText: { fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionHeading: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sectionMeta: { fontSize: 13, color: colors.muted },
  topbar: { marginTop: 4, marginBottom: 12 },
  topbarTitle: { fontSize: 24, fontWeight: '800', color: colors.ink },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorViewText: {
    color: colors.ink2,
    fontWeight: '700',
    textAlign: 'center',
  },
  retry: { marginTop: 18, alignSelf: 'stretch' },
  empty: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 12 },
  emptyIcon: { fontSize: 40, marginBottom: 6 },
  emptyText: { color: colors.muted, fontWeight: '700', textAlign: 'center' },
});
