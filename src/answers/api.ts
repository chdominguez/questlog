import type { Grade, GradeRequest, Improvement, Me, MockStart, Note, NoteInput, Profile, PushSubscriptionInput, Reminder, SavedAnswer } from "../../shared/api-types";
import { ApiError, apiFetch, call } from "../api";

export { ApiError };

const send = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const post = (body: unknown) => send("POST", body);
/** POST that spends credits: one Idempotency-Key per user action. */
const spend = (body: unknown, key: string): RequestInit => ({ ...post(body), headers: { "Content-Type": "application/json", "Idempotency-Key": key } });

export const GRADE_TIMEOUT_MS = 100_000; // a bit above the server's own model timeout

export const gradeAnswer = (req: GradeRequest, key: string, signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(GRADE_TIMEOUT_MS);
  return call<Grade>("/grade", { ...spend(req, key), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
};
export const improveAnswer = (answerId: string, key: string) =>
  call<Improvement>(`/answers/${encodeURIComponent(answerId)}/improve`, { ...spend({}, key), signal: AbortSignal.timeout(GRADE_TIMEOUT_MS) });
export const startMock = (courseId: string, key: string) => call<MockStart>("/mock", spend({ courseId }, key));
export const saveAnswer = (a: Omit<SavedAnswer, "id" | "createdAt">) => call<SavedAnswer>("/answers", post(a));
export const listAnswers = (challengeId?: string) =>
  call<SavedAnswer[]>(`/answers${challengeId ? `?challengeId=${encodeURIComponent(challengeId)}` : ""}`);

export const listNotes = (q = "", tag = "") => call<Note[]>(`/notes?${new URLSearchParams({ q, tag })}`);
export const getNote = (id: string) => call<Note>(`/notes/${encodeURIComponent(id)}`);
export const createNote = (n: NoteInput) => call<Note>("/notes", post(n));
export const updateNote = (id: string, n: NoteInput) => call<Note>(`/notes/${encodeURIComponent(id)}`, send("PUT", n));
export const deleteNote = async (id: string) => {
  const res = await apiFetch(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
};

export const getMe = () => call<Me>("/me");
export const getProfile = () => call<Profile>("/profile");
export const saveProfile = (p: Profile) => call<Profile>("/profile", send("PUT", p));

export const getPushKey = () => call<{ key: string }>("/push/key");
export const savePushSubscription = async (s: PushSubscriptionInput) => { await apiFetch("/push/subscription", send("POST", s)); };
export const deletePushSubscription = async (endpoint: string) => { await apiFetch("/push/subscription", send("DELETE", { endpoint })); };
export const listReminders = () => call<Reminder[]>("/reminders");
export const saveReminder = (r: Reminder) => call<Reminder>("/reminders", send("PUT", r));
export const deleteReminder = async (course: string) => { await apiFetch(`/reminders/${encodeURIComponent(course)}`, { method: "DELETE" }); };
