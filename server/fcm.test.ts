import { createVerify, generateKeyPairSync } from "node:crypto";
import { expect, test } from "vitest";
import { fcmSender } from "./fcm";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = { project_id: "proj", client_email: "push@proj.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
const b64 = Buffer.from(JSON.stringify(account)).toString("base64");

const fakeFetch = (send: (body: any) => Response) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "at", expires_in: 3600 });
    return send(JSON.parse(init.body as string));
  }) as unknown as typeof fetch;
  return { f, calls };
};

test("FCM: signed service-account JWT, v1 payload, access token cached", async () => {
  const now = 1_700_000_000_000;
  const { f, calls } = fakeFetch(() => Response.json({ name: "m" }));
  const send = fcmSender(b64, f, () => now);
  expect(await send("tok1", { title: "Course", body: "Time to study", url: "/#/c/x" })).toBe("ok");
  expect(await send("tok2", { title: "Course", body: "Time to study", url: "/#/c/x" })).toBe("ok");
  expect(calls.map((c) => c.url)).toEqual([
    "https://oauth2.googleapis.com/token",
    "https://fcm.googleapis.com/v1/projects/proj/messages:send",
    "https://fcm.googleapis.com/v1/projects/proj/messages:send",
  ]);

  const form = new URLSearchParams(calls[0].init.body as URLSearchParams);
  expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [head, claims, sig] = form.get("assertion")!.split(".");
  expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
  expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
    iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now / 1000, exp: now / 1000 + 3600,
  });
  expect(createVerify("RSA-SHA256").update(`${head}.${claims}`).verify(publicKey, sig, "base64url")).toBe(true);

  expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer at");
  expect(JSON.parse(calls[1].init.body as string)).toEqual({
    message: { token: "tok1", notification: { title: "Course", body: "Time to study" }, data: { url: "/#/c/x" } },
  });
});

test("FCM: UNREGISTERED is gone, other errors throw", async () => {
  const { f } = fakeFetch((b) => b.message.token === "dead"
    ? Response.json({ error: { code: 404, status: "NOT_FOUND", details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } }, { status: 404 })
    : Response.json({ error: { code: 500, status: "INTERNAL" } }, { status: 500 }));
  const send = fcmSender(b64, f);
  expect(await send("dead", { title: "t", body: "b", url: "/" })).toBe("gone");
  await expect(send("other", { title: "t", body: "b", url: "/" })).rejects.toThrow("500");
});

test("FCM: a service account without a key is rejected", () => {
  expect(() => fcmSender(Buffer.from("{}").toString("base64"), fetch)).toThrow();
});
