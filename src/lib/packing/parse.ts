import type { PackingLine, PackingPackage, PartySnapshot } from "@/lib/packing/types";
import { emptyParty } from "@/lib/packing/types";

export function partyFromJson(raw: unknown): PartySnapshot {
  if (!raw || typeof raw !== "object") return emptyParty();
  const o = raw as Record<string, unknown>;
  return {
    name: String(o.name ?? ""),
    address_line1: o.address_line1 != null ? String(o.address_line1) : "",
    address_line2: o.address_line2 != null ? String(o.address_line2) : "",
    city: o.city != null ? String(o.city) : "",
    state: o.state != null ? String(o.state) : "",
    pin: o.pin != null ? String(o.pin) : "",
    country: o.country != null ? String(o.country) : "",
    gstin: o.gstin != null ? String(o.gstin) : "",
    contact_name: o.contact_name != null ? String(o.contact_name) : "",
    mobile: o.mobile != null ? String(o.mobile) : "",
  };
}

export function packagesFromJson(raw: unknown): PackingPackage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, i) => {
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const linesRaw = Array.isArray(o.lines) ? o.lines : [];
    const lines = linesRaw.map((l) => {
      if (!l || typeof l !== "object") {
        return {
          description: "",
          unit: "Pcs",
          qty: 1,
          save_as_item: true as const,
        };
      }
      const x = l as Record<string, unknown>;
      const pidRaw = x.item_preset_id;
      const item_preset_id =
        typeof pidRaw === "string" && pidRaw.trim() ? pidRaw.trim() : undefined;
      const line: PackingLine = {
        description: String(x.description ?? ""),
        unit: String(x.unit ?? "Pcs"),
        qty: Number(x.qty) || 0,
        make_service_provider:
          x.make_service_provider != null ? String(x.make_service_provider) : "",
        model_part_no_description:
          x.model_part_no_description != null ? String(x.model_part_no_description) : "",
        hsn_sac: x.hsn_sac != null ? String(x.hsn_sac) : "",
        ...(item_preset_id ? { item_preset_id } : {}),
        ...(typeof x.save_as_item === "boolean" ? { save_as_item: x.save_as_item } : {}),
      };
      return line;
    });
    const base = {
      package_no: Number(o.package_no) || i + 1,
      package_type: String(o.package_type ?? ""),
      package_size: String(o.package_size ?? ""),
      package_weight_kg:
        o.package_weight_kg === null || o.package_weight_kg === undefined
          ? null
          : Number(o.package_weight_kg),
      packing_remarks: String(o.packing_remarks ?? ""),
      lines: lines.length ? lines : [{ description: "", unit: "Pcs", qty: 1 }],
    };
    if (o.package_type_mode === "other") {
      return { ...base, package_type_mode: "other" as const };
    }
    return base;
  }).filter(Boolean) as PackingPackage[];
}

/** Sum of `package_weight_kg` across packages. Null when no package has a finite weight. */
export function totalGrossWeightKgFromPackages(packages: PackingPackage[]): number | null {
  let sum = 0;
  let any = false;
  for (const p of packages) {
    const w = p.package_weight_kg;
    if (w != null && Number.isFinite(w)) {
      sum += w;
      any = true;
    }
  }
  return any ? sum : null;
}

export function formatPackingGrossWeightDisplay(packages: PackingPackage[]): string {
  const t = totalGrossWeightKgFromPackages(packages);
  if (t == null) return "—";
  return `${Number(t.toFixed(3))} kg`;
}
