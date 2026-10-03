/**
 * Profile (the prototype's #/s/profile): the student's initials, name, email
 * and year level; the 8 badges (earned in color, locked dimmed; tap for
 * details); and Account: Edit profile, Change password, About GuessUp and
 * Log out. The badge list comes from GET /me/summary, reloaded on focus.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace } from '../../../src/components/BottomNav';
import { Dialog } from '../../../src/components/Dialog';
import {
  Avatar,
  Button,
  ErrorText,
  Field,
  PasswordField,
  Pill,
  SectionTitle,
  showToast,
} from '../../../src/components/ui';
import { YearLevelPicker } from '../../../src/components/YearLevelPicker';
import { apiErrorMessage } from '../../../src/lib/api';
import {
  YEAR_LEVELS,
  changePassword,
  updateProfile,
  type User,
  type YearLevel,
} from '../../../src/lib/auth';
import { useAuth } from '../../../src/lib/auth-context';
import { date } from '../../../src/lib/format';
import { fetchSummary, type BadgeInfo, type MeSummary } from '../../../src/lib/game';
import { colors } from '../../../src/theme';

type Open = 'edit' | 'password' | 'about' | { badge: BadgeInfo } | null;

/** The school and program named in the prototype's About dialog. */
const ABOUT =
  'GuessUp is a gamified guessing game for reviewing core IT subjects of the ' +
  'Bachelor of Science in Information Technology program at ' +
  'J.H. Cerilles State College – Dumingag Campus.';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState<Open>(null);

  const [summary, setSummary] = useState<MeSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const next = await fetchSummary();
      if (id !== latest.current) return;
      setSummary(next);
      setError('');
    } catch (e) {
      if (id === latest.current) setError(apiErrorMessage(e));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          void logout();
        },
      },
    ]);
  }

  const earned = new Map(summary?.badges.map((b) => [b.code, b.earnedAt]) ?? []);
  const close = () => setOpen(null);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[s.screen, { paddingBottom: bottomNavSpace(insets.bottom) }]}
      >
        <View style={s.head}>
          <Avatar name={user?.fullName} size={84} />
          <Text style={s.name}>{user?.fullName}</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={s.pills}>
            <Pill tone="brand">{user?.yearLevel || 'Student'}</Pill>
            <Pill>BSIT</Pill>
          </View>
        </View>

        <SectionTitle
          title="Badges"
          right={summary ? `${summary.badges.length} of ${summary.allBadges.length}` : undefined}
        />
        {summary ? (
          <View style={s.badgeGrid}>
            {summary.allBadges.map((badge, i) => {
              const have = earned.has(badge.code);
              return (
                <Pressable
                  key={badge.code}
                  accessibilityRole="button"
                  accessibilityLabel={`${badge.name}, ${have ? 'unlocked' : 'locked'}`}
                  onPress={() => setOpen({ badge })}
                  style={({ pressed }) => [
                    s.badge,
                    i % 3 !== 2 && s.badgeGap,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={[s.badgeIcon, !have && s.locked]}>{badge.icon}</Text>
                  <Text style={[s.badgeName, !have && s.badgeNameLocked]}>{badge.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : error && !loading ? (
          <View style={s.badgeError}>
            <ErrorText>{error}</ErrorText>
            <Button title="Try again" variant="ghost" small onPress={() => void load()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.brand} style={s.spinner} />
        )}

        <SectionTitle title="Account" />
        <View style={s.menu}>
          <MenuItem first label="✏️ Edit profile" onPress={() => setOpen('edit')} />
          <MenuItem label="🔒 Change password" onPress={() => setOpen('password')} />
          <MenuItem label="ℹ️ About GuessUp" onPress={() => setOpen('about')} />
          <MenuItem label="🚪 Log out" danger disabled={leaving} onPress={confirmLogout} />
        </View>
      </ScrollView>

      {open !== null && typeof open === 'object' ? (
        <BadgeDialog badge={open.badge} earnedAt={earned.get(open.badge.code)} onClose={close} />
      ) : null}
      {open === 'edit' && user ? <EditProfileDialog user={user} onClose={close} /> : null}
      {open === 'password' ? <PasswordDialog onClose={close} /> : null}
      <Dialog
        visible={open === 'about'}
        title="About GuessUp"
        onClose={close}
        footer={<Button title="Close" onPress={close} />}
      >
        <Text style={s.text}>{ABOUT}</Text>
        <Text style={[s.small, s.aboutNote]}>
          Scores are for review only and are not part of official grades.
        </Text>
      </Dialog>
    </SafeAreaView>
  );
}

function MenuItem({
  label,
  onPress,
  first = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  first?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.menuItem, !first && s.menuDivider, pressed && s.menuPressed]}
    >
      <Text style={[s.menuText, danger && s.danger]}>{label}</Text>
    </Pressable>
  );
}

function BadgeDialog({
  badge,
  earnedAt,
  onClose,
}: {
  badge: BadgeInfo;
  earnedAt: string | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog
      visible
      onClose={onClose}
      footer={<Button title="OK" style={s.flex} onPress={onClose} />}
    >
      <View style={s.badgeDetail}>
        <Text style={[s.badgeDetailIcon, !earnedAt && s.lockedDetail]}>{badge.icon}</Text>
        <Text style={s.badgeDetailName}>{badge.name}</Text>
        <Text style={s.badgeDetailDesc}>{badge.description}</Text>
        <View style={s.badgeDetailPill}>
          {earnedAt ? <Pill tone="ok">Unlocked {date(earnedAt)}</Pill> : <Pill>🔒 Locked</Pill>}
        </View>
      </View>
    </Dialog>
  );
}

function EditProfileDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { updateUser } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  // Like the prototype's select, which shows the first option when none is saved.
  const [yearLevel, setYearLevel] = useState<YearLevel>(
    YEAR_LEVELS.find((y) => y === user.yearLevel) ?? YEAR_LEVELS[0],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = fullName.trim();
    if (!name) return setError('Name is required.');
    // Server limits, checked here so the student sees a friendly message.
    if (name.length < 2 || name.length > 80)
      return setError('Full name must be 2 to 80 characters.');
    setError('');
    setSaving(true);
    try {
      await updateUser(await updateProfile({ fullName: name, yearLevel }));
      onClose();
      showToast('Profile updated');
    } catch (e) {
      setError(apiErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Dialog
      visible
      title="Edit profile"
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" disabled={saving} onPress={onClose} />
          <Button title="Save" loading={saving} onPress={() => void save()} />
        </>
      }
    >
      <Field
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        editable={!saving}
        autoComplete="name"
        textContentType="name"
        onSubmitEditing={() => void save()}
      />
      <YearLevelPicker value={yearLevel} onChange={setYearLevel} disabled={saving} />
      <ErrorText>{error}</ErrorText>
    </Dialog>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function update() {
    // The prototype's checks and wording; the server checks the current password.
    if (!current) return setError('Current password is incorrect.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    setError('');
    setSaving(true);
    try {
      await changePassword(current, next);
      onClose();
      showToast('Password changed');
    } catch (e) {
      setError(apiErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Dialog
      visible
      title="Change password"
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" disabled={saving} onPress={onClose} />
          <Button title="Update" loading={saving} onPress={() => void update()} />
        </>
      }
    >
      <PasswordField
        label="Current password"
        value={current}
        onChangeText={setCurrent}
        editable={!saving}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
      />
      <PasswordField
        label="New password"
        value={next}
        onChangeText={setNext}
        placeholder="At least 8 characters"
        editable={!saving}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordField
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        editable={!saving}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void update()}
      />
      <ErrorText>{error}</ErrorText>
    </Dialog>
  );
}

const cardShadow = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  screen: { paddingHorizontal: 18, paddingTop: 6 },
  head: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, gap: 2 },
  name: { marginTop: 10, fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  email: { fontSize: 13, fontWeight: '700', color: colors.muted },
  pills: { flexDirection: 'row', gap: 6, marginTop: 8 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  badge: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...cardShadow,
  },
  badgeGap: { marginRight: '3.5%' },
  pressed: { transform: [{ scale: 0.97 }] },
  badgeIcon: { fontSize: 32 },
  // React Native cannot grayscale an emoji; dimming stands in for the prototype's filter.
  locked: { opacity: 0.3 },
  badgeName: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 14.5,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  badgeNameLocked: { color: colors.muted },
  badgeError: { gap: 8, alignItems: 'flex-start' },
  spinner: { marginVertical: 20 },
  menu: { backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', ...cardShadow },
  menuItem: { paddingVertical: 14, paddingHorizontal: 16 },
  menuDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  menuPressed: { backgroundColor: colors.bg },
  menuText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  danger: { color: colors.bad },
  text: { fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontSize: 13, color: colors.muted },
  aboutNote: { marginTop: 10 },
  badgeDetail: { alignItems: 'center', paddingVertical: 10 },
  badgeDetailIcon: { fontSize: 56 },
  lockedDetail: { opacity: 0.35 },
  badgeDetailName: { marginTop: 6, fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  badgeDetailDesc: { marginTop: 6, color: colors.muted, textAlign: 'center' },
  badgeDetailPill: { marginTop: 12 },
});
