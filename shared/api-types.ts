/** HTTP contract between the browser (src/answers/api.ts) and the server (server/api.ts). */

export interface GradeRequest {
  challengeId: string; // qualified "<course>:<id>"; the worker looks up prompt, model answer and key points
  answer: string; // user's written answer
}

export interface Grade {
  score: number; // 0-10
  covered: string[]; // key points the answer covered
  missing: string[]; // key points missing
  mistakes: string[]; // wrong or risky statements
  improved: string; // improved answer in the user's voice, in the course language
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

export interface Note {
  id: string;
  title: string;
  body: string; // Markdown
  tags: string[];
  courseId?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type NoteInput = Pick<Note, "title" | "body" | "tags" | "courseId">;

export interface Profile { name: string; title: string; location: string; link: string; bio: string }

export interface SyncedProgress { value: unknown; updatedAt: number }

// Every /api route needs the signed-in user from the proxy header -> 401 otherwise.
// POST   /api/grade        body GradeRequest           -> 200 Grade | 4xx/5xx { error: string }
// POST   /api/answers      body Omit<SavedAnswer,"id"|"createdAt"> -> 201 SavedAnswer
// GET    /api/answers      ?challengeId=              -> SavedAnswer[] (newest first)
// GET    /api/export                                  -> text/markdown, all answers grouped by challenge
// GET    /api/progress                                -> SyncedProgress | 404
// PUT    /api/progress     body SyncedProgress        -> { stored: boolean } (stored only when newer)
// GET    /api/notes        ?q=&tag=                   -> Note[] (newest updated first)
// GET    /api/notes/:id                               -> Note | 404
// POST   /api/notes        body NoteInput             -> 201 Note
// PUT    /api/notes/:id    body NoteInput             -> Note | 404
// DELETE /api/notes/:id                               -> 204 | 404
// GET    /api/me                                      -> { user, name? } (name: Keycloak display name from NAME_HEADER)
// GET    /api/profile                                 -> Profile (empty strings when unset)
// PUT    /api/profile      body Profile               -> Profile
// GET    /api/health                                 -> { ok: true, grader: boolean }
