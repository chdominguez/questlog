import type { PushState } from "../engine/push";

// Stub until WP10 (mobile): FCM; the native branch of src/engine/push.ts.

export async function pushState(): Promise<PushState> { return "unsupported"; }
export async function enablePush(): Promise<PushState> { return "unsupported"; }
