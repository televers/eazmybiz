import type { PackingPackage } from "@/lib/packing/types";

/** Canonical labels stored in `package_type` for standard options. */
export const STANDARD_PACKAGE_TYPES = ["Carton", "Box", "Drum", "Roll", "Envelope"] as const;

export type StandardPackageType = (typeof STANDARD_PACKAGE_TYPES)[number];

/** `<select>` value for the "Other" option (not stored on the document). */
export const PACKAGE_TYPE_SELECT_OTHER = "__other__";

export function canonicalStandardPackageType(raw: string): StandardPackageType | null {
  const t = raw.trim();
  if (!t) return null;
  const found = STANDARD_PACKAGE_TYPES.find((x) => x.toLowerCase() === t.toLowerCase());
  return found ?? null;
}

/** Value for the package-type `<select>` controlled field. */
export function packageTypeSelectValue(pkg: Pick<PackingPackage, "package_type" | "package_type_mode">): string {
  if (pkg.package_type_mode === "other") return PACKAGE_TYPE_SELECT_OTHER;
  const c = canonicalStandardPackageType(pkg.package_type);
  if (c) return c;
  if (pkg.package_type.trim()) return PACKAGE_TYPE_SELECT_OTHER;
  return "";
}
