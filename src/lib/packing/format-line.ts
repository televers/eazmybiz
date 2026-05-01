import type { PackingLine } from "@/lib/packing/types";

/**
 * Optional second line under item description: model / part, then make / provider (comma-separated).
 * Same visual pattern as quotation PDF optional line.
 */
export function formatPackingOptionalDetailLine(line: PackingLine): string {
  const model = (line.model_part_no_description ?? "").trim();
  const make = (line.make_service_provider ?? "").trim();
  if (model && make) return `${model}, ${make}`;
  if (model) return model;
  if (make) return make;
  return "";
}
