import type { Grade, GradeRequest, SavedAnswer } from "../../shared/api-types";

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

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const GRADE_TIMEOUT_MS = 100_000; // a bit above the server's own model timeout

export const gradeAnswer = (req: GradeRequest, signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(GRADE_TIMEOUT_MS);
  return call<Grade>("/grade", { ...post(req), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
};
export const saveAnswer = (a: Omit<SavedAnswer, "id" | "createdAt">) => call<SavedAnswer>("/answers", post(a));
export const listAnswers = (challengeId?: string) =>
  call<SavedAnswer[]>(`/answers${challengeId ? `?challengeId=${encodeURIComponent(challengeId)}` : ""}`);
