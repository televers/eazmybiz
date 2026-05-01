import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import { PartyAddressLabelsPrint } from "@/components/parties/party-address-labels-print";
import { linesShippedFromOrganization } from "@/lib/parties/address-label-print";
import { buildPartyListRow, type PartyAddressRow } from "@/lib/parties/load-parties";

export default async function PartyAddressLabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "parties");

  const supabase = await createClient();
  const { data: party } = await supabase
    .from("parties")
    .select("id, display_name, updated_at, managed_by_user_id")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!party) notFound();

  const { data: addrs } = await supabase
    .from("party_addresses")
    .select("*")
    .eq("party_id", id)
    .eq("organization_id", ctx.organization.id);

  const partyRow = buildPartyListRow(
    {
      id: party.id as string,
      display_name: party.display_name as string,
      updated_at: (party.updated_at as string) ?? new Date().toISOString(),
      managed_by_user_id: (party as { managed_by_user_id?: string | null }).managed_by_user_id ?? null,
    },
    (addrs ?? []) as PartyAddressRow[],
  );

  const shippedFromLines = linesShippedFromOrganization(ctx.organization);
  if (shippedFromLines.length === 0) {
    return (
      <div className="min-h-screen p-6 text-[var(--foreground)]">
        <Link href={`/parties/${id}`} className="text-sky-600 underline">
          ← Back to party
        </Link>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Add your organization address in settings (organization address fields) to print &quot;Shipped From&quot;
          labels.
        </p>
      </div>
    );
  }

  const shipOptions = partyRow.ship_tos.map((s) => ({ slot: s.slot, snapshot: s.snapshot }));
  const poweredBy = poweredByLine(ctx.organization.plan);

  return (
    <PartyAddressLabelsPrint
      partyId={id}
      partyDisplayName={partyRow.display_name}
      billTo={partyRow.bill_to}
      shippedFromLines={shippedFromLines}
      shipOptions={shipOptions}
      poweredBy={poweredBy}
    />
  );
}
