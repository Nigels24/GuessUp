import { StyleSheet } from 'react-native';
import { colors } from '../theme';

/** Layout shared by the login and register screens (the prototype's .auth, .auth-card, .auth-alt). */
export const authStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  gear: {
    position: 'absolute',
    top: 8,
    right: 14,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { fontSize: 22, color: colors.muted },
  hero: { alignItems: 'center', marginBottom: 22 },
  title: {
    marginTop: 14,
    fontSize: 34,
    fontWeight: '800',
    color: colors.brandDark,
  },
  tagline: { color: colors.muted, fontWeight: '700', marginTop: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#2E1A8C',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  eye: { paddingHorizontal: 8, paddingVertical: 6 },
  eyeText: { fontSize: 13, fontWeight: '800', color: colors.brand },
  alt: { textAlign: 'center', marginTop: 16, fontSize: 14, color: colors.ink },
  altLink: { fontWeight: '800', color: colors.brand },
});
