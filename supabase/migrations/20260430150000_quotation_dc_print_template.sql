-- Reuse packing_list_template enum for quotation & delivery challan print/PDF themes.
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS template packing_list_template NOT NULL DEFAULT 'basic';

ALTER TABLE delivery_challans
  ADD COLUMN IF NOT EXISTS template packing_list_template NOT NULL DEFAULT 'basic';
