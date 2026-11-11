import type { Grade, GradeRequest, Note, NoteInput, SavedAnswer } from "../../shared/api-types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const send = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const post = (body: unknown) => send("POST", body);

export const GRADE_TIMEOUT_MS = 100_000; // a bit above the server's own model timeout

export const gradeAnswer = (req: GradeRequest, signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(GRADE_TIMEOUT_MS);
  return call<Grade>("/grade", { ...post(req), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
};
export const saveAnswer = (a: Omit<SavedAnswer, "id" | "createdAt">) => call<SavedAnswer>("/answers", post(a));
export const listAnswers = (challengeId?: string) =>
  call<SavedAnswer[]>(`/answers${challengeId ? `?challengeId=${encodeURIComponent(challengeId)}` : ""}`);

export const listNotes = (q = "", tag = "") => call<Note[]>(`/notes?${new URLSearchParams({ q, tag })}`);
export const getNote = (id: string) => call<Note>(`/notes/${encodeURIComponent(id)}`);
export const createNote = (n: NoteInput) => call<Note>("/notes", post(n));
export const updateNote = (id: string, n: NoteInput) => call<Note>(`/notes/${encodeURIComponent(id)}`, send("PUT", n));
export const deleteNote = async (id: string) => {
  const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
};
