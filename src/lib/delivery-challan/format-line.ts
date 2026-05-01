import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";

/** Optional line under description: model / part, then make / provider (quotation-style). */
export function formatDeliveryChallanOptionalDetailLine(line: DeliveryChallanLine): string {
  const model = (line.model_part_no_description ?? "").trim();
  const make = (line.make_service_provider ?? "").trim();
  if (model && make) return `${model}, ${make}`;
  if (model) return model;
  if (make) return make;
  return "";
}
