/** HTTP contract between the clients (src/api.ts) and the server (server/api.ts). Frozen in wave B: changes go through the coordinator. */

export interface GradeRequest {
  challengeId: string; // qualified "<course>:<id>"; the worker looks up prompt, model answer and key points
  answer: string; // user's written answer
  mockId?: string; // grade inside a paid mock session (free while it lasts)
}

export interface Grade {
  score: number; // 0-10
  covered: string[]; // key points the answer covered
  missing: string[]; // key points missing
  mistakes: string[]; // wrong or risky statements
  improved?: string; // stronger answer in the user's voice, in the course language (old grades; new ones via /answers/:id/improve)
  corrections?: Correction[];
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

export interface PushSubscriptionInput { endpoint: string; p256dh: string; auth: string }

/** Daily study reminder for a course: time is "HH:MM" on the device clock in tz (IANA zone). */
export interface Reminder { courseId: string; title: string; time: string; tz: string }

export interface SyncedProgress { value: unknown; updatedAt: number }

export type ErrorCode =
  | "invalid_request" | "unauthorized" | "insufficient_credits" | "origin_not_allowed" | "forbidden" | "not_found"
  | "idempotency_conflict" | "in_progress" | "already_subscribed" | "mock_exhausted" | "mock_expired"
  | "too_large" | "unsupported_media_type" | "topic_too_broad" | "course_invalid" | "rate_limited" | "job_limit"
  | "ai_failed" | "not_configured";
export interface ApiErrorBody { error: string; code: ErrorCode; [extra: string]: unknown }

export interface Health { ok: true; commit: string; grader: boolean; narration: boolean }

export type Action = "course_topic" | "course_files" | "course_web" | "grade" | "improve" | "mock" | "narration";
export type Costs = Record<Action, number>;

export interface Subscription {
  provider: "stripe" | "revenuecat";
  store?: "app_store" | "play_store";
  status: "active" | "past_due" | "canceled" | "expired";
  periodEnd: string | null; // ISO
  cancelAtPeriodEnd: boolean;
}
export interface Credits {
  plan: number; topup: number; total: number;
  planExpiresAt: string | null;
  freeCourses: number; // free topic builds left
  subscription: Subscription | null;
  costs: Costs; confirmAt: number; lowAt: number;
  notice?: string; // CREDITS_NOTICE
}
export interface Me {
  user: string; // Better Auth user id
  email: string; name: string; image?: string;
  admin: boolean;
  aliases: string[]; // legacy ids claimed by this user (old email key, "local", "")
  features: { ai: boolean; billing: boolean; narration: boolean };
  credits: Credits | null; // null when billing off
  limits: { uploadMaxBytes: number; uploadMaxFiles: number };
}

export type LedgerKind = "plan_grant" | "plan_expire" | "pack" | "spend" | "refund" | "free_course" | "free_refund" | "store_refund" | "stripe_refund" | "adjust";
// label: course title (builds, mock) or level title (narration); the client adds "Course: ", "Mock exam: ", "Narration: "
export interface LedgerRow { id: string; kind: LedgerKind; delta: number; action: Action | null; ref: string | null; label: string | null; createdAt: string }
export interface LedgerPage { rows: LedgerRow[]; next: string | null }

export type CheckoutItem = "plan" | "pack_s" | "pack_l";
export interface FulfillResult { status: "paid" | "processing" | "unpaid" | "expired"; item: CheckoutItem; credited: number; balance: number }

export interface Correction { quote: string; fix: string }
export interface Improvement { improved: string; corrections: Correction[] }
export interface MockStart { mockId: string; expiresAt: string }

export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type BuildRequest =
  | { mode: "topic"; topic: string; level: SkillLevel; lang: string }
  | { mode: "files"; uploads?: string[]; noteIds?: string[]; urls?: string[]; level: SkillLevel; lang: string; instructions?: string }
  | { mode: "web"; topic: string; level: SkillLevel; lang: string };
export interface Upload { id: string; name: string; bytes: number }

export type JobStatus = "queued" | "running" | "done" | "failed";
export interface Job {
  id: string; kind: "build" | "narration"; status: JobStatus;
  title: string | null; // topic, or outline title once known
  mode?: BuildRequest["mode"];
  result: { courseId: string } | null;
  error: { code: string; message: string; refunded: boolean; free?: boolean } | null;
  createdAt: string; finishedAt: string | null;
}
export type JobEvent = { seq: number; at: string } & (
  | { type: "stage"; data: { stage: "research" | "read" | "outline" | "write" | "validate" | "fix" | "save"; done?: number; of?: number } }
  | { type: "sources"; data: { count: number } }
  | { type: "outline"; data: { title: string; levels: { id: string; title: string }[] } }
  | { type: "level"; data: { id: string; status: "written" | "fixed" } }
  | { type: "problems"; data: { attempt: number; count: number } }
  | { type: "done"; data: { courseId?: string; tracks?: number } }
  | { type: "failed"; data: { code: string; message: string; refunded: boolean } }
);
export interface JobPoll { job: Job; events: JobEvent[] }

export type CourseStatus = "private" | "link" | "pending" | "public" | "rejected";
export type CourseMode = "topic" | "files" | "web" | "upload";
export interface UserCourseMeta {
  id: string; title: string; lang: string; summary: string | null;
  status: CourseStatus; mine: boolean; author: string; mode: CourseMode;
  levels: number; sources: number; version: number;
  reviewNote: string | null; updatedAt: string; publishedAt: string | null;
}
export type FlagReason = "wrong" | "unclear" | "broken" | "other";
export interface FlagInput { courseId: string; itemId?: string; reason: FlagReason; text?: string } // text <= 500
export interface Flag extends FlagInput { id: string; count: number; createdAt: string }
export interface ReviewQueue { pending: UserCourseMeta[]; flags: Flag[] }

export interface NarrationTrack { card: number; hash: string; ready: boolean }
export interface NarrationState { unlocked: boolean; cost: number; voice: string; tracks: NarrationTrack[]; jobId?: string }

export interface DeviceInput { token: string; platform: "ios" | "android" }

// Every route below /api/auth, /api/health and /api/webhooks needs a session (cookie or bearer) -> 401 otherwise.
// Errors: ApiErrorBody. Full route table: docs/design/questie.md section 3.2.
// POST   /api/grade        body GradeRequest           -> 200 Grade | 4xx/5xx ApiErrorBody
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
// GET    /api/me                                      -> Me
// GET    /api/profile                                 -> Profile (empty strings when unset)
// PUT    /api/profile      body Profile               -> Profile
// GET    /api/push/key                               -> { key } (VAPID public) | 503 when reminders are off
// POST   /api/push/subscription body PushSubscriptionInput -> 204
// DELETE /api/push/subscription body { endpoint }     -> 204
// GET    /api/reminders                               -> Reminder[]
// PUT    /api/reminders    body Reminder              -> Reminder (upsert by courseId)
// DELETE /api/reminders/:course                       -> 204
// GET    /api/health                                 -> Health (public)
