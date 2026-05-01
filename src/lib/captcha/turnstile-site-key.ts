/** Public site key (client). When empty, Turnstile is skipped (local dev if Supabase CAPTCHA is off). */
export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

export function isTurnstileConfigured(): boolean {
  return turnstileSiteKey().length > 0;
}
