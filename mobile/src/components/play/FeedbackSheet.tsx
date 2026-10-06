/**
 * The prototype's feedback sheet after each answer: ✅ / ⏰ / ❌ (or 👀 after
 * "I don't know"), the title, the points, the correct answer and the
 * explanation, then "Next question →" or, after the last item, "See results 🏁".
 */
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AnswerResult } from '../../lib/game';
import { count } from '../../lib/format';
import { colors } from '../../theme';
import { Button, ErrorText } from '../ui';

export interface Feedback {
  result: AnswerResult;
  /** The server judged a timeout, or the app's timer ran out. */
  timedOut: boolean;
  hintUsed: boolean;
  /** The student tapped "I don't know"; the server saw a plain wrong answer. */
  gaveUp: boolean;
  /** Picked once per answer, like the prototype's random title. */
  title: string;
}

const CORRECT_TITLES = ['Correct!', 'Nice one!', 'You got it!', 'Brilliant!'];

export function feedbackTitle(correct: boolean, timedOut: boolean, gaveUp: boolean): string {
  if (gaveUp) return 'Answer revealed';
  if (correct) return CORRECT_TITLES[Math.floor(Math.random() * CORRECT_TITLES.length)]!;
  return timedOut ? "Time's up!" : 'Not quite!';
}

export function FeedbackSheet({
  feedback,
  hintPenalty,
  busy,
  error,
  onContinue,
  onRequestClose,
}: {
  feedback: Feedback | null;
  hintPenalty: number;
  busy: boolean;
  error: string;
  onContinue: () => void;
  /** Android back while the sheet is open. */
  onRequestClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const correct = !!feedback?.result.isCorrect;
  const gaveUp = !correct && !!feedback?.gaveUp;

  return (
    <Modal
      visible={!!feedback}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={s.overlay}>
        {feedback && (
          <View style={[s.sheet, { paddingBottom: 18 + insets.bottom }]}>
            <ScrollView contentContainerStyle={s.body} bounces={false}>
              <View
                style={[
                  s.icon,
                  {
                    backgroundColor: correct
                      ? colors.okSoft
                      : gaveUp
                        ? colors.brandSoft
                        : colors.badSoft,
                  },
                ]}
              >
                <Text style={s.iconText}>
                  {correct ? '✅' : gaveUp ? '👀' : feedback.timedOut ? '⏰' : '❌'}
                </Text>
              </View>
              <Text
                style={[
                  s.title,
                  { color: correct ? colors.ok : gaveUp ? colors.ink2 : colors.bad },
                ]}
              >
                {feedback.title}
              </Text>
              {gaveUp && <Text style={s.zero}>0 points</Text>}
              {correct && (
                <Text style={s.points}>
                  +{count(feedback.result.pointsEarned, 'point')}
                  {feedback.hintUsed ? (
                    <Text style={s.penalty}> (hint −{hintPenalty})</Text>
                  ) : null}
                </Text>
              )}
              <View style={s.answer}>
                <Text style={s.answerLabel}>CORRECT ANSWER</Text>
                <Text style={s.answerText}>{feedback.result.correctAnswer}</Text>
              </View>
              {feedback.result.explanation ? (
                <Text style={s.explanation}>📘 {feedback.result.explanation}</Text>
              ) : null}
            </ScrollView>
            <View style={s.foot}>
              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button
                title={feedback.result.isLastItem ? 'See results 🏁' : 'Next question →'}
                variant={correct ? 'ok' : 'primary'}
                loading={busy}
                onPress={onContinue}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '90%',
  },
  body: { paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  iconText: { fontSize: 38 },
  title: { fontSize: 26, fontWeight: '800' },
  points: { marginTop: 4, fontSize: 20, fontWeight: '800', color: colors.brandDark },
  zero: { marginTop: 4, fontSize: 16, fontWeight: '800', color: colors.muted },
  penalty: { fontSize: 13, color: colors.muted },
  answer: {
    alignSelf: 'stretch',
    marginVertical: 12,
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 12,
  },
  answerLabel: { fontSize: 13, fontWeight: '800', color: colors.muted },
  answerText: { marginTop: 2, fontSize: 16, fontWeight: '800', color: colors.ink },
  explanation: { alignSelf: 'stretch', fontSize: 14, color: colors.ink2 },
  foot: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 12,
  },
});
