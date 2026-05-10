import { isTurnstileConfigured } from "@/lib/captcha/turnstile-site-key";

/** In production, human verification must be configured (see workspace pre-launch checklist). */
export function authCaptchaRequiredButMissing(): boolean {
  return process.env.NODE_ENV === "production" && !isTurnstileConfigured();
}
