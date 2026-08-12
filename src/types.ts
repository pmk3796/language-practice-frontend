// Shapes shared with the backend contract.

export interface WordPair {
  target: string
  english: string
}

export interface Translation {
  english: string
  target: string
}

export interface Correction {
  correctedSentence: string
  explanation: string
}

export interface LanguageOption {
  code: string
  name: string
  nativeName: string
  flag: string
}

export interface LevelOption {
  id: string
  code: string
  name: string
  blurb: string
}

export interface ProfileOption {
  id: string
  name: string
  emoji: string
  description: string
}

// A rendered chat message. `words` is present on assistant messages for the
// click-to-toggle behaviour. `pending` marks a message still being streamed.
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  words?: WordPair[]
  audioUrl?: string
  pending?: boolean
}

export interface TranslationEntry extends Translation {
  id: string
}

export interface CorrectionEntry extends Correction {
  id: string
}

// A vocabulary flashcard, reviewed with a simple Leitner box (1 = new).
export interface Flashcard {
  id: string
  target: string
  english: string
  box: number
  createdAt: number
  // Behavioral metadata (tracked locally as you review).
  lastReviewedAt?: number
  /**
   * The session this card was saved during, so a conversation can show what it
   * produced. Absent on cards added by hand and on anything saved before this
   * was recorded — both correctly read as "not from this conversation".
   */
  sessionId?: string
  reviewCount?: number
  wrongCount?: number
  // Semantic metadata (added lazily by AI, cached forever).
  topic?: string
  partOfSpeech?: string
  tagged?: boolean
}

// The AI-generated summary shown when a session ends.
export interface Recap {
  summary: string
  strengths: string[]
  focusAreas: string[]
  vocab: WordPair[]
}

// One practice conversation. Language + profile are fixed at creation.
// endedAt !== null means it's archived (read-only) and has a recap.
export interface Session {
  id: string
  language: string
  profile: string
  createdAt: number
  endedAt: number | null
  messages: ChatMessage[]
  translations: TranslationEntry[]
  corrections: CorrectionEntry[]
  recap: Recap | null
}
