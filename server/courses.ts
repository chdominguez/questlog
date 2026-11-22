import { Hono, type Context } from "hono";
import type { CourseMode } from "../shared/api-types";
import type { CourseInput } from "../src/course/schema";
import { COURSES, type Course } from "../src/course/registry";
import type { App, Deps } from "./api";
import type { Db } from "./db";
import { err } from "./errors";

// Stub until WP5 (builder): static courses only, no user courses.

/** Static COURSES first, then user_courses under the access rule. */
export async function findCourse(_db: Db, id: string, _user: string): Promise<Course | null> {
  return COURSES.find((c) => c.id === id) ?? null;
}

/** Saves a validated course for its owner; returns the course id. */
export async function saveUserCourse(_db: Db, _a: { owner: string; course: CourseInput; mode: CourseMode; sourceJobId?: string }): Promise<string> {
  throw new Error("User courses are not available");
}

const none = (c: Context) => err(c, 404, "not_found");

export function coursesRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>()
    .get("/courses", (c) => c.json([]))
    .get("/courses/:id", none)
    .put("/courses/:id", none)
    .delete("/courses/:id", none);
}
