/**
 * Play screen (the prototype's #/s/play). The server owns the round: the
 * screen always draws what GET /current returns, timer included, so it
 * recovers from an app restart or a return from the background.
 *
 * Flow: GET /current (idempotent for the item POST /sessions already served)
 * → answer → feedback sheet → "Next question" (GET /current serves the next
 * item and starts its clock) … → "See results" (POST /finish) → result.
 * When /current answers 409 every item is answered (or the round is over),
 * so the screen finishes the round and shows the result.
 */
import axios from 'axios';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FeedbackSheet,
  feedbackTitle,
  type Feedback,
} from '../../../src/components/play/FeedbackSheet';
import { PuzzleInput, emptySlots, puzzleValue } from '../../../src/components/play/PuzzleInput';
import { QuestionImage } from '../../../src/components/play/QuestionImage';
import {
  Button,
  ErrorText,
  ErrorView,
  LoadingView,
  Pill,
  showToast,
} from '../../../src/components/ui';
import { apiErrorMessage } from '../../../src/lib/api';
import {
  abandonRound,
  fetchCurrent,
  finishRound,
  levelInfo,
  rememberFinished,
  requestHint,
  submitAnswer,
  type QuestionType,
  type RoundState,
} from '../../../src/lib/game';
import { colors } from '../../../src/theme';

type Phase = 'loading' | 'playing' | 'feedback' | 'error';

const TYPE_PILL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: '🔤 Multiple Choice',
  PICTURE: '🖼️ Picture Guess',
  WORD_PUZZLE: '🧩 Word Puzzle',
};

const is409 = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 409;

export default function PlayScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [round, setRound] = useState<RoundState | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [quitting, setQuitting] = useState(false);

  // Answer input for the current item.
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [slots, setSlots] = useState<(number | null)[]>([]);
  /** The correct answer once known, to color the choices. */
  const [revealed, setRevealed] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  /** The timeout could not be sent; the student retries by hand. */
  const [timeoutFailed, setTimeoutFailed] = useState(false);
  /** "I don't know" was confirmed: the countdown stops while it is sent. */
  const [gaveUp, setGaveUp] = useState(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sheetError, setSheetError] = useState('');

  // Mirrors for callbacks that outlive a render (timer, AppState, back button).
  const roundRef = useRef<RoundState | null>(null);
  const phaseRef = useRef<Phase>('loading');
  const busyRef = useRef(false);
  const deadline = useRef(0);
  /** Index of the item already submitted, so the timeout is sent once. */
  const answeredIndex = useRef<number | null>(null);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  /** Runs one request at a time; buttons are disabled meanwhile. */
  const exclusive = useCallback(async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  /* ---------- server state ---------- */

  /**
   * Draws a RoundState. 'sync' keeps the local item (choice order, letters
   * placed, text typed) when the server still has the same item current.
   */
  const applyRound = useCallback((state: RoundState, mode: 'new' | 'sync') => {
    const previous = roundRef.current;
    const sameItem = mode === 'sync' && previous?.item.index === state.item.index;
    const next = sameItem && previous ? { ...state, item: previous.item } : state;
    roundRef.current = next;
    setRound(next);

    if (!sameItem) {
      setChosen(null);
      setTyped('');
      setSlots(emptySlots(state.item.answerLength ?? 0));
      setRevealed(null);
    }
    // The server says this item is still unanswered.
    answeredIndex.current = null;
    setTimeoutFailed(false);
    setGaveUp(false);
    setActionError('');

    deadline.current = Date.now() + state.secondsRemaining * 1000;
    setRemaining(state.secondsRemaining);
    setFeedback(null);
    setSheetError('');
    setPhaseBoth('playing');
  }, []);

  const showResult = useCallback(() => {
    router.replace({
      pathname: '/result/[sessionId]',
      params: { sessionId, fresh: '1' },
    });
  }, [sessionId]);

  /** POST /finish, then the result. 409: already finished (or over), the result screen sorts it out. */
  const finish = useCallback(async () => {
    try {
      rememberFinished(await finishRound(sessionId));
    } catch (error) {
      if (!is409(error)) throw error;
    }
    showResult();
  }, [sessionId, showResult]);

  /** GET /current; 409 means nothing is left to play, so finish. */
  const loadCurrent = useCallback(
    async (mode: 'new' | 'sync') => {
      try {
        applyRound(await fetchCurrent(sessionId), mode);
      } catch (error) {
        if (!is409(error)) throw error;
        await finish();
      }
    },
    [applyRound, finish, sessionId],
  );

  const firstLoad = useCallback(() => {
    setPhaseBoth('loading');
    void exclusive(async () => {
      try {
        await loadCurrent('new');
      } catch (error) {
        setLoadError(apiErrorMessage(error));
        setPhaseBoth('error');
      }
    });
  }, [exclusive, loadCurrent]);

  useEffect(firstLoad, [firstLoad]);

  /* ---------- answering ---------- */

  /**
   * `value` undefined: the timer ran out, or with `giveUp` the student tapped
   * "I don't know". Both send no answer; before the time limit the server
   * records a wrong answer with 0 points and reveals the answer.
   */
  const submit = useCallback(
    (value: string | undefined, giveUp = false) => {
      const current = roundRef.current;
      if (!current || phaseRef.current !== 'playing' || busyRef.current) return;
      const index = current.item.index;
      if (answeredIndex.current === index) return;
      answeredIndex.current = index;
      const timedOutHere = value === undefined && !giveUp;
      if (giveUp) setGaveUp(true);
      if (value !== undefined && current.item.type === 'MULTIPLE_CHOICE') setChosen(value);
      setActionError('');

      void exclusive(async () => {
        try {
          const result = await submitAnswer(sessionId, index, value);
          const timedOut = result.timedOut || timedOutHere;
          setPhaseBoth('feedback'); // stops the timer
          setRevealed(result.correctAnswer);
          setRound((prev) => {
            const next = prev && {
              ...prev,
              totalScore: result.totalScore,
              results: [...prev.results, result.isCorrect],
            };
            roundRef.current = next;
            return next;
          });
          const sheet: Feedback = {
            result,
            timedOut,
            hintUsed: current.hintUsed,
            gaveUp: giveUp && !timedOut,
            title: feedbackTitle(result.isCorrect, timedOut, giveUp && !timedOut),
          };
          // The prototype lets the colored choices show for a moment first.
          setTimeout(() => setFeedback(sheet), current.item.type === 'MULTIPLE_CHOICE' ? 550 : 150);
        } catch (error) {
          if (is409(error)) {
            // Already answered or no longer current: redraw from the server.
            try {
              await loadCurrent('sync');
            } catch (e) {
              setActionError(apiErrorMessage(e));
            }
            return;
          }
          setActionError(apiErrorMessage(error));
          if (timedOutHere) {
            setTimeoutFailed(true);
          } else {
            answeredIndex.current = null;
            setChosen(null);
            setGaveUp(false);
          }
        }
      });
    },
    [exclusive, loadCurrent, sessionId],
  );

  const retryTimeout = () => {
    answeredIndex.current = null;
    setTimeoutFailed(false);
    submit(undefined);
  };

  function confirmGiveUp() {
    if (phaseRef.current !== 'playing' || busyRef.current) return;
    Alert.alert("Don't know this one?", "You'll get 0 points, but you'll see the answer.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Show answer', onPress: () => submit(undefined, true) },
    ]);
  }

  function submitTyped() {
    const value = typed.trim();
    if (!value) return showToast('Type your answer first.');
    submit(value);
  }

  function submitPuzzle() {
    const item = round?.item;
    if (!item) return;
    if (slots.some((slot) => slot === null)) return showToast('Fill in all the boxes first.');
    submit(puzzleValue(item.scrambledLetters ?? [], slots, item.wordLengths ?? []));
  }

  /* ---------- timer ---------- */

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (phase !== 'playing' || gaveUp) return;
    const tick = () => {
      const left = Math.max(0, (deadline.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) submitRef.current(undefined);
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [phase, gaveUp]);

  // Back from the background: take the time left from the server's clock.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || phaseRef.current !== 'playing' || busyRef.current) return;
      void exclusive(async () => {
        try {
          await loadCurrent('sync');
        } catch {
          // Offline: keep the local countdown.
        }
      });
    });
    return () => sub.remove();
  }, [exclusive, loadCurrent]);

  /* ---------- hint, next, quit ---------- */

  function takeHint() {
    const current = roundRef.current;
    if (!current || !current.hintsAllowed || current.hintUsed || phaseRef.current !== 'playing')
      return;
    void exclusive(async () => {
      try {
        const hint = await requestHint(sessionId);
        setRound((prev) => {
          const next = prev && { ...prev, hintUsed: true, hint };
          roundRef.current = next;
          return next;
        });
      } catch (error) {
        showToast(apiErrorMessage(error));
      }
    });
  }

  function next() {
    const last = feedback?.result.isLastItem;
    setSheetError('');
    void exclusive(async () => {
      try {
        if (last) await finish();
        else await loadCurrent('new');
      } catch (error) {
        setSheetError(apiErrorMessage(error));
      }
    });
  }

  const quittingRef = useRef(false);
  const confirmQuit = useCallback(() => {
    if (quittingRef.current) return;
    Alert.alert('Quit this round?', 'Your answers in this round will not be saved.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'Quit round',
        style: 'destructive',
        onPress: () => {
          quittingRef.current = true;
          setQuitting(true);
          void (async () => {
            try {
              await abandonRound(sessionId);
            } catch {
              // Already over, or offline: the next round started abandons it anyway.
            }
            router.dismissTo('/home');
          })();
        },
      },
    ]);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmQuit();
        return true;
      });
      return () => sub.remove();
    }, [confirmQuit]),
  );

  /* ---------- drawing ---------- */

  if (phase === 'error') {
    return (
      <SafeAreaView style={s.safe}>
        <ErrorView message={loadError} retrying={busy} onRetry={firstLoad} />
        <View style={s.errorHome}>
          <Button title="Back to Home" variant="ghost" onPress={() => router.dismissTo('/home')} />
        </View>
      </SafeAreaView>
    );
  }

  if (!round) {
    return (
      <SafeAreaView style={s.safe}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  const { item } = round;
  const level = levelInfo(round.difficulty);
  const locked = phase !== 'playing' || busy || timeoutFailed || quitting || gaveUp;
  const fraction = Math.max(0, Math.min(1, remaining / round.secondsPerItem));
  const danger = remaining <= 10;
  const warn = !danger && remaining <= round.secondsPerItem * 0.5;
  const barColor = danger ? colors.bad : warn ? colors.warn : colors.ok;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
          <View style={s.top}>
            <Pressable
              onPress={confirmQuit}
              accessibilityRole="button"
              accessibilityLabel="Quit round"
              hitSlop={8}
              style={s.iconBtn}
            >
              <Text style={s.iconBtnText}>✕</Text>
            </Pressable>
            <View style={s.progress}>
              {Array.from({ length: round.totalItems }, (_, i) => {
                const result = round.results[i];
                return (
                  <View
                    key={i}
                    style={[
                      s.segment,
                      result === true && { backgroundColor: colors.ok },
                      result === false && { backgroundColor: colors.bad },
                      result === undefined && i === item.index - 1 && { backgroundColor: colors.brand },
                    ]}
                  />
                );
              })}
            </View>
            <View style={s.scoreChip}>
              <Text style={s.scoreText}>⭐ {round.totalScore}</Text>
            </View>
          </View>

          <View style={s.timer} accessibilityLabel={`${Math.ceil(remaining)} seconds left`}>
            <View style={s.timerBar}>
              <View
                style={[s.timerFill, { width: `${fraction * 100}%`, backgroundColor: barColor }]}
              />
            </View>
            <Text style={[s.timerNum, danger && { color: colors.bad }]}>
              {Math.ceil(remaining)}
            </Text>
          </View>

          <View style={s.card}>
            <View style={s.meta}>
              <Pill tone="brand">{TYPE_PILL[item.type]}</Pill>
              <Pill color={level.color}>{level.label}</Pill>
              <Pill>
                {item.index} / {round.totalItems}
              </Pill>
            </View>
            <Text style={s.question}>{item.questionText}</Text>
            {item.codeSnippet ? (
              <View style={s.code}>
                <Text style={s.codeText}>{item.codeSnippet}</Text>
              </View>
            ) : null}
            {item.type === 'PICTURE' && item.imageUrl ? (
              <QuestionImage imageUrl={item.imageUrl} />
            ) : null}
            {round.hint ? (
              <View style={s.hintBox}>
                <Text style={s.hintText}>💡 {round.hint}</Text>
              </View>
            ) : null}
          </View>

          {item.type === 'MULTIPLE_CHOICE' && (
            <View style={s.choices}>
              {(item.choices ?? []).map((choice, i) => {
                const isAnswer = revealed !== null && choice === revealed;
                const isWrong = revealed !== null && choice === chosen && choice !== revealed;
                return (
                  <Pressable
                    key={`${i}-${choice}`}
                    accessibilityRole="button"
                    disabled={locked}
                    onPress={() => submit(choice)}
                    style={({ pressed }) => [
                      s.choice,
                      pressed && !locked && s.choicePressed,
                      isAnswer && s.choiceCorrect,
                      isWrong && s.choiceWrong,
                    ]}
                  >
                    <View style={s.key}>
                      <Text style={s.keyText}>{'ABCD'[i] ?? ''}</Text>
                    </View>
                    <Text style={s.choiceText}>{choice}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {item.type === 'PICTURE' && (
            <View style={s.answerRow}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                editable={!locked}
                placeholder="Type your answer…"
                placeholderTextColor="#A9A5C4"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                returnKeyType="done"
                onSubmitEditing={submitTyped}
                style={s.input}
              />
            </View>
          )}

          {item.type === 'WORD_PUZZLE' && (
            <PuzzleInput
              tiles={item.scrambledLetters ?? []}
              wordLengths={item.wordLengths ?? []}
              slots={slots}
              onChange={setSlots}
              disabled={locked}
            />
          )}

          {actionError ? (
            <View style={s.actionError}>
              <ErrorText>{actionError}</ErrorText>
              {timeoutFailed && <Button title="Try again" onPress={retryTimeout} loading={busy} />}
            </View>
          ) : null}

          <View style={s.actions}>
            <Button
              variant="ghost"
              style={s.flex}
              disabled={locked || !round.hintsAllowed || round.hintUsed}
              onPress={takeHint}
              title={
                !round.hintsAllowed ? (
                  '🚫 No hints'
                ) : round.hintUsed ? (
                  '💡 Hint used'
                ) : (
                  <>
                    💡 Hint <Text style={s.hintPenalty}>−{round.hintPenalty}</Text>
                  </>
                )
              }
            />
            {item.type !== 'MULTIPLE_CHOICE' && (
              <Button
                title="Submit"
                style={s.flex}
                disabled={locked}
                onPress={item.type === 'PICTURE' ? submitTyped : submitPuzzle}
              />
            )}
          </View>
          <Button
            title="🤷 I don't know"
            variant="ghost"
            small
            style={s.dontKnow}
            disabled={locked}
            onPress={confirmGiveUp}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <FeedbackSheet
        feedback={feedback}
        hintPenalty={round.hintPenalty}
        busy={busy}
        error={sheetError}
        onContinue={next}
        onRequestClose={confirmQuit}
      />
    </SafeAreaView>
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
  screen: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24 },
  errorHome: { paddingHorizontal: 24, paddingBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16, color: colors.ink2 },
  progress: { flex: 1, flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 8, borderRadius: 9, backgroundColor: colors.track },
  scoreChip: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  scoreText: { fontWeight: '800', fontSize: 14, color: colors.ink },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  timerBar: {
    flex: 1,
    height: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  timerFill: { height: '100%', borderRadius: 12 },
  timerNum: { width: 44, textAlign: 'right', fontSize: 20, fontWeight: '800', color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 22, padding: 18, ...cardShadow },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  question: { fontSize: 18, fontWeight: '800', lineHeight: 24, color: colors.ink },
  code: { marginTop: 12, backgroundColor: colors.codeBg, borderRadius: 14, padding: 12 },
  codeText: {
    color: colors.codeText,
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  hintBox: {
    marginTop: 12,
    backgroundColor: colors.warnSoft,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hintText: { fontSize: 14, fontWeight: '700', color: colors.hintText },
  choices: { gap: 10, marginTop: 14 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomWidth: 5,
    backgroundColor: colors.white,
  },
  choicePressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  choiceCorrect: {
    borderColor: colors.ok,
    borderBottomColor: colors.okBorder,
    backgroundColor: colors.okSoft,
  },
  choiceWrong: {
    borderColor: colors.bad,
    borderBottomColor: colors.badBorder,
    backgroundColor: colors.badSoft,
  },
  key: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 13, fontWeight: '800', color: colors.brandDark },
  choiceText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink },
  answerRow: { marginTop: 14 },
  input: {
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  actionError: { marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  dontKnow: { alignSelf: 'center', marginTop: 10, minHeight: 44, borderWidth: 0 },
  hintPenalty: { fontSize: 13, color: colors.muted },
});
