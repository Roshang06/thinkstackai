export type Level = "middle" | "high" | "university";

export type ProseBlock = {
  id: string;
  type: "prose";
  heading: string;
  body: string;
};

export type EquationBlock = {
  id: string;
  type: "equation";
  latex: string;
  caption: string;
};

export type GraphBlock = {
  id: string;
  type: "graph";
  title: string;
  expression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type QuizBlock = {
  id: string;
  type: "quiz";
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

export type ShortAnswerBlock = {
  id: string;
  type: "short_answer";
  prompt: string;
  accepted: string[];
  explanation: string;
};

export type Flashcard = { front: string; back: string };

export type FlashcardsBlock = {
  id: string;
  type: "flashcards";
  title: string;
  cards: Flashcard[];
};

export type CodeBlock = {
  id: string;
  type: "code";
  title: string;
  language: "javascript" | "python";
  starter: string;
};

export type SimulationBlock = {
  id: string;
  type: "simulation";
  title: string;
  kind: "wave" | "projectile";
  note: string;
};

export type WidgetBlock = {
  id: string;
  type: "widget";
  title: string;
  brief: string;
  html: string;
};

export type Block =
  | ProseBlock
  | EquationBlock
  | GraphBlock
  | QuizBlock
  | ShortAnswerBlock
  | FlashcardsBlock
  | CodeBlock
  | SimulationBlock
  | WidgetBlock;

export type LessonSection = {
  id: string;
  title: string;
  objective: string;
  interaction: string;
  blocks: Block[];
};

export type LessonStage = "drafting" | "ready";

export type Lesson = {
  id: string;
  ownerId: string;
  ownerName: string;
  institution: string;
  title: string;
  topic: string;
  level: Level;
  minutes: number;
  tags: string[];
  visibility: "private" | "public";
  summary: string;
  blocks: Block[];
  sections: LessonSection[];
  stage: LessonStage;
  activity: string;
  createdAt: string;
  updatedAt: string;
};

export type LessonSummary = {
  id: string;
  ownerId: string;
  ownerName: string;
  institution: string;
  title: string;
  topic: string;
  level: Level;
  minutes: number;
  tags: string[];
  visibility: "private" | "public";
  summary: string;
  blockCount: number;
  sectionCount: number;
  stage: LessonStage;
  createdAt: string;
  updatedAt: string;
};

export type Progress = {
  userId: string;
  lessonId: string;
  completedBlockIds: string[];
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  lessonId: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
};

export type Account = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
  createdAt: string;
};

export type LessonDraftInput = {
  topic: string;
  level: Level;
  minutes: number;
  notes?: string;
  ownerId: string;
  ownerName: string;
};

export type CommandInput = {
  instruction: string;
  blockId?: string | null;
  sectionId?: string | null;
  selection?: string | null;
};
