import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorCode } from "../shared/api-types";

const TEXT: Record<ErrorCode, string> = {
  invalid_request: "Invalid request",
  unauthorized: "Unauthorized",
  insufficient_credits: "Not enough credits",
  origin_not_allowed: "Origin not allowed",
  forbidden: "Forbidden",
  not_found: "Not found",
  idempotency_conflict: "Idempotency key already used",
  in_progress: "Already in progress",
  already_subscribed: "Already subscribed",
  mock_exhausted: "No grades left in this mock exam",
  mock_expired: "Mock exam expired",
  too_large: "Request too large",
  unsupported_media_type: "Unsupported media type",
  topic_too_broad: "Topic too broad",
  course_invalid: "Course invalid",
  rate_limited: "Too many requests",
  job_limit: "A build is already running",
  ai_failed: "AI request failed",
  not_configured: "Not configured",
};

/** The one error shape: `{ error, code, ...extra }`. `message` overrides the default human text. */
export const err = (c: Context, status: number, code: ErrorCode, extra: object = {}, message?: string): Response =>
  c.json({ error: message ?? TEXT[code], code, ...extra }, status as ContentfulStatusCode);
