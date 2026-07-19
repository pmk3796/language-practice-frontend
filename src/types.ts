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
}
