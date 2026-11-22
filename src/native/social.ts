// Stub until WP10 (mobile).

/** Native Google or Apple ID token for signIn.social; null when cancelled. */
export async function idToken(_provider: "google" | "apple"): Promise<{ token: string; nonce?: string } | null> {
  return null;
}
