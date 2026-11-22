import { expect, test } from "vitest";
import { attempt, authMessage, validEmail } from "./messages";

test("auth errors map to the UX lines", () => {
  expect(authMessage(null, "x")).toBe("Couldn't connect");
  expect(authMessage({ status: 429 }, "x")).toBe("Too many attempts. Wait a minute.");
  expect(authMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "x")).toBe("Wrong email or password");
  expect(authMessage({ code: "EMAIL_NOT_VERIFIED", status: 403 }, "x")).toBe("Email not verified");
  expect(authMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 }, "x")).toBe("Email already registered");
  expect(authMessage({ code: "INVALID_TOKEN", status: 400 }, "x")).toBe("Link expired");
  expect(authMessage({ code: "SOMETHING", status: 500 }, "Couldn't sign in")).toBe("Couldn't sign in");
});

test("attempt turns a thrown fetch into a null error and keeps the code of a server error", async () => {
  expect(await attempt(async () => { throw new TypeError("offline"); })).toEqual({ data: null, error: null });
  expect(await attempt(async () => ({ data: null, error: { code: "X", status: 400, message: "m" } }))).toEqual({ data: null, error: { code: "X", status: 400 } });
  expect(await attempt(async () => ({ data: 1, error: null }))).toEqual({ data: 1, error: false });
});

test("email check", () => {
  expect(validEmail(" a@b.co ")).toBe(true);
  expect(validEmail("a@b")).toBe(false);
});
