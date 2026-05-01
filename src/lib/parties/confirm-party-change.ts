/** Client-only: confirm switching linked party A → B in document editors. */
export function confirmPartyChange(
  parties: { id: string; display_name: string }[],
  previousPartyId: string,
  nextPartyId: string,
): boolean {
  if (previousPartyId === nextPartyId) return true;
  const a = parties.find((p) => p.id === previousPartyId)?.display_name ?? previousPartyId;
  const b = parties.find((p) => p.id === nextPartyId)?.display_name ?? nextPartyId;
  return window.confirm(
    `You're changing the party from "${a}" to "${b}". Please confirm to change the party.`,
  );
}
