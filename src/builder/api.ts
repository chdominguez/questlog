import type { BuildRequest, Job, JobPoll, Upload } from "../../shared/api-types";
import { markCoursesLoaded } from "../course/registry";

// Stub until WP5 (builder): no user courses yet.

/**
 * Registers the cached course list (ql.courses) synchronously, before its first await: main.tsx calls it before the
 * first render. Then fetches GET /courses and course JSON for new versions, and marks the registry loaded.
 */
export async function loadCourses(): Promise<void> {
  markCoursesLoaded();
}

/** A course not in the registry (opened by link): fetch and register it. False when the server has none. */
export async function fetchCourse(_id: string): Promise<boolean> {
  return false;
}

const unavailable = () => Promise.reject(new Error("Course builder not available"));
export const startBuild = (_req: BuildRequest, _key: string): Promise<{ jobId: string }> => unavailable();
export const uploadSource = (_file: File): Promise<Upload> => unavailable();
export const getJob = (_id: string, _after?: number): Promise<JobPoll> => unavailable();
export const listJobs = (): Promise<Job[]> => Promise.resolve([]);
