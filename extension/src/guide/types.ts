export type StepKind = "create-file" | "code";

export interface Concept { name: string; explanation: string; docs: string }
/** `line` is 1-based. */
export interface Anchor { text?: string; line?: number }
export interface Problem { file: string; line: number; explanation: string }
export interface Question { question: string; answer: string }
export interface Review { approved: boolean; message: string; problems: Problem[]; suggestions: string[] }

export interface Step {
  id: number;
  kind: StepKind;
  title: string;
  file: string;
  where: string;
  anchor?: Anchor;
  goal: string;
  concepts: Concept[];
  /** Private: never shown in the panel. */
  criteria: string[];
  /** Private: never shown in the panel. */
  hints: string[];
  done: boolean;
  hintLevel: number;
  lastHint?: string;
  lastReview?: Review;
  lastQuestion?: Question;
}

export interface Guide {
  version: 1;
  request: string;
  title: string;
  overview: string;
  /** 0-based index; equals steps.length once the guide is finished. */
  currentIndex: number;
  finished: boolean;
  summary?: string;
  steps: Step[];
}
