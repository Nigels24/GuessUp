/**
 * Game constants the panel shows. The rules themselves live on the server
 * (api/src/common/game-rules.ts); keep these labels and numbers in step with it.
 */

export type Difficulty = "EASY" | "AVERAGE" | "DIFFICULT";
export type QuestionType = "MULTIPLE_CHOICE" | "PICTURE" | "WORD_PUZZLE";
export type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

/** The prototype's levels (Chapter I – Purpose and Description). */
export const LEVELS: Record<Difficulty, { label: string; seconds: number; points: number; hints: number; color: string }> = {
  EASY: { label: "Easy", seconds: 60, points: 10, hints: 1, color: "#22C55E" },
  AVERAGE: { label: "Average", seconds: 45, points: 20, hints: 1, color: "#F59E0B" },
  DIFFICULT: { label: "Difficult", seconds: 30, points: 30, hints: 0, color: "#EF4444" },
};
export const DIFFICULTIES = Object.keys(LEVELS) as Difficulty[];

export const TYPES: Record<QuestionType, { label: string; icon: string }> = {
  MULTIPLE_CHOICE: { label: "Multiple Choice", icon: "🔤" },
  PICTURE: { label: "Picture Guess", icon: "🖼️" },
  WORD_PUZZLE: { label: "Word Puzzle", icon: "🧩" },
};
export const QUESTION_TYPES = Object.keys(TYPES) as QuestionType[];

export const SESSION_STATUS: Record<SessionStatus, { label: string; pill: string }> = {
  COMPLETED: { label: "Completed", pill: "pill-ok" },
  IN_PROGRESS: { label: "In progress", pill: "pill-brand" },
  ABANDONED: { label: "Abandoned", pill: "pill-gray" },
};

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

/** Word puzzle rules, as the server checks them (question.rules.ts). */
export const PUZZLE_MAX_LETTERS = 16;
export const MC_DISTRACTORS = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
