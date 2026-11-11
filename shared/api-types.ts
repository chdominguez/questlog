/** HTTP contract between the browser (src/answers/api.ts) and the server (server/api.ts). */

export interface GradeRequest {
  challengeId: string;
  prompt: string;
  model: string; // model answer
  keyPoints: string[];
  answer: string; // user's written answer
}

export interface Grade {
  score: number; // 0-10
  covered: string[]; // key points the answer covered
  missing: string[]; // key points missing
  mistakes: string[]; // wrong or risky statements
  improved: string; // improved answer in the user's voice, Spanish
}

export interface SavedAnswer {
  id: string;
  challengeId: string;
  levelId: string;
  prompt: string;
  answer: string;
  source: "typed" | "dictated" | "mixed";
  seconds?: number; // time spent
  grade?: Grade;
  selfScore?: number; // 0-10, self-rating (Bien/Regular/Repasar) when there is no grade
  createdAt: string; // ISO
}

// POST /api/grade        body GradeRequest           -> 200 Grade | 4xx/5xx { error: string }
// POST /api/answers      body Omit<SavedAnswer,"id"|"createdAt"> -> 201 SavedAnswer
// GET  /api/answers      ?challengeId=              -> SavedAnswer[] (newest first)
// GET  /api/export                                  -> text/markdown, all answers grouped by challenge
// GET  /api/health                                  -> { ok: true, grader: boolean }
