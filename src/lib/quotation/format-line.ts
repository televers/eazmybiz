import type { QuotationLine } from "@/lib/quotation/types";

/**
 * Optional second line under product/service name: model / part / description, then make / provider (comma-separated).
 * Empty if both optional fields are blank.
 */
export function formatQuotationOptionalDetailLine(line: QuotationLine): string {
  const model = line.model_part_no_description.trim();
  const make = line.make_service_provider.trim();
  if (model && make) return `${model}, ${make}`;
  if (model) return model;
  if (make) return make;
  return "";
}
