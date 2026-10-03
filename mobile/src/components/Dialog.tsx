/**
 * The prototype's small centered modal (GU.ui.modal with size 'sm'): an
 * optional title with a ✕ button, a scrolling body and a footer of buttons.
 * Tapping outside, ✕ or Android back closes it unless `locked` (a request is
 * under way).
 */
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';

export function Dialog({
  visible,
  title,
  onClose,
  locked = false,
  children,
  footer,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  locked?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const close = () => {
    if (!locked) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.overlay} onPress={close} accessibilityLabel="Close">
          {/* Taps inside the dialog must not reach the overlay. */}
          <Pressable style={s.modal} onPress={() => undefined} accessible={false}>
            {title ? (
              <View style={s.head}>
                <Text style={s.title} accessibilityRole="header">
                  {title}
                </Text>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  style={s.closeBtn}
                >
                  <Text style={s.closeText}>✕</Text>
                </Pressable>
              </View>
            ) : null}
            <ScrollView
              style={s.bodyScroll}
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer ? <View style={s.foot}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.ink },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, color: colors.ink2 },
  bodyScroll: { flexGrow: 0 },
  body: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 16 },
  foot: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
