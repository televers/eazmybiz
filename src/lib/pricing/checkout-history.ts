/**
 * Sets the canonical /settings/pricing URL on the **current** history entry (no navigation).
 * Used before redirects to gateways and after return (`replace` / terminal states) so return query strings
 * are not duplicated in the stack; avoids an extra history entry tied only to transient gateway params when
 * combined with redirect flows.
 *
 * Preserves `history.state` for App Router compatibility.
 */
export function replacePricingPageHistoryEntry(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state ?? null, "", "/settings/pricing");
}
