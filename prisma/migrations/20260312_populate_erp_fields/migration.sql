-- Populate generic ERP fields for existing Omie-linked customers
UPDATE "Customer"
SET "erpProvider" = 'OMIE',
    "erpCustomerId" = "omie_codigo_cliente"::text,
    "erpLastSyncAt" = "omie_last_sync_at"
WHERE "omie_codigo_cliente" IS NOT NULL
  AND "erpProvider" IS NULL;

-- Populate generic ERP fields for existing Omie-linked charges
UPDATE "Charge"
SET "erpProvider" = 'OMIE',
    "erpChargeId" = "omie_codigo_titulo"::text,
    "erpLastSyncAt" = "omie_last_sync_at"
WHERE "omie_codigo_titulo" IS NOT NULL
  AND "erpProvider" IS NULL;
