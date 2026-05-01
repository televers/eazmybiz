"use client";

import { useCallback } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { isTurnstileConfigured, turnstileSiteKey } from "@/lib/captcha/turnstile-site-key";

type AuthTurnstileProps = {
  onTokenChange: (token: string | null) => void;
  /** Ref to call `.reset()` after a failed auth attempt (new challenge). */
  turnstileRef: React.RefObject<TurnstileInstance | null>;
  className?: string;
};

export function AuthTurnstile({ onTokenChange, turnstileRef, className }: AuthTurnstileProps) {
  const siteKey = turnstileSiteKey();

  const onSuccess = useCallback(
    (token: string) => {
      onTokenChange(token);
    },
    [onTokenChange],
  );

  const onExpireOrError = useCallback(() => {
    onTokenChange(null);
  }, [onTokenChange]);

  if (!isTurnstileConfigured()) return null;

  return (
    <div className={className}>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={onSuccess}
        onExpire={onExpireOrError}
        onError={onExpireOrError}
        onTimeout={onExpireOrError}
        options={{ theme: "auto", size: "normal" }}
      />
    </div>
  );
}
