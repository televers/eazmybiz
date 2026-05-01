import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import { GatePassAutoprint } from "@/components/gate-pass/gate-pass-autoprint";
import { GatePassPrintToolbar } from "@/components/gate-pass/gate-pass-print-toolbar";
import { GatePassPrintView } from "@/components/gate-pass/gate-pass-print-view";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";

type GatePassRow = {
  doc_number: string;
  document_date: string;
  direction: string;
  status: string;
  invoice_no: string | null;
  party_name: string | null;
  transport_name: string | null;
  lr_docket_no: string | null;
  hand_carried_name: string | null;
  hand_carried_mobile: string | null;
  vehicle_no: string | null;
  package_count: number | null;
  material_description: string | null;
  notes: string | null;
  issued_at: string | null;
  material_moved_at: string | null;
};

export default async function GatePassPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "gate_pass");

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("gate_passes")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const r = row as GatePassRow;

  if (r.status === "draft") {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
        <Link href={`/gate-passes/${id}`} className="text-sky-600 underline">
          ← Back to gate pass
        </Link>
        <p className="mt-6 text-sm text-[var(--muted)]">Issue the gate pass to print.</p>
      </div>
    );
  }

  if (r.material_moved_at) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
        <Link href={`/gate-passes/${id}`} className="text-sky-600 underline">
          ← Back to gate pass
        </Link>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Printing is not available after material movement has been recorded at the gate.
        </p>
      </div>
    );
  }

  const powered = poweredByLine(ctx.organization.plan);
  const passDateLabel = r.document_date
    ? `Pass date ${formatDateDdMmYyyy(String(r.document_date).slice(0, 10))}`
    : null;
  const issuedLabel = r.issued_at
    ? `Issued ${new Date(r.issued_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })}`
    : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] print:bg-white">
      <GatePassAutoprint />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A5 portrait; margin: 10mm; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          `,
        }}
      />
      <div className="mx-auto max-w-[148mm] px-4 py-6 print:max-w-none print:p-0">
        <GatePassPrintToolbar />
        <p className="mb-4 text-sm text-[var(--muted)] print:hidden">
          A5 portrait. In print preview, choose A5 and default margins if needed.
        </p>

        <div className="flex justify-center print:block">
          <GatePassPrintView
            companyName={ctx.organization.name}
            docNumber={r.doc_number}
            passDateLabel={passDateLabel}
            directionLabel={r.direction === "in" ? "Inward" : "Outward"}
            invoiceOrDc={r.invoice_no?.trim() || "—"}
            partyName={r.party_name?.trim() || "—"}
            transportName={r.transport_name?.trim() || "—"}
            lrDocketNo={r.lr_docket_no?.trim() || "—"}
            handCarriedName={r.hand_carried_name?.trim() || "—"}
            handCarriedMobile={r.hand_carried_mobile?.trim() || "—"}
            vehicleNo={r.vehicle_no?.trim() || "—"}
            packageCount={r.package_count != null ? String(r.package_count) : "—"}
            mainItem={r.material_description?.trim() || "—"}
            notes={r.notes?.trim() ? r.notes : null}
            issuedAtLabel={issuedLabel}
            poweredBy={powered}
          />
        </div>
      </div>
    </div>
  );
}
