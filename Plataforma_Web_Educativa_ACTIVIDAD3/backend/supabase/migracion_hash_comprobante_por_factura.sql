/* =============================================================================
   Educar para Transformar - Migración: comprobante duplicado por FACTURA,
   no global (RFM-06/HU8)
   -----------------------------------------------------------------------------
   comprobante_transferencia.hash_archivo tenía un UNIQUE a secas (global:
   ningún archivo se podía repetir en TODA la tabla), por eso un padre que
   reutilizaba la misma imagen de prueba para otra factura siempre recibía
   "el archivo ya fue cargado anteriormente" aunque nunca la hubiera subido
   para esa factura. El enunciado (RFM-06/HU8) pide la restricción "en la
   MISMA factura", no global.

   Reemplaza ese UNIQUE(hash_archivo) por UNIQUE(factura_id, hash_archivo).

   Es idempotente: se puede correr más de una vez.
   Ejecución: pegar en el SQL Editor de Supabase y correr.
   ============================================================================= */

BEGIN;

DO $$
DECLARE
    v_old_constraint TEXT;
BEGIN
    SELECT con.conname INTO v_old_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'comprobante_transferencia'
      AND con.contype = 'u'
      AND (
          SELECT array_agg(a.attname ORDER BY a.attname)
          FROM unnest(con.conkey) AS k(attnum)
          JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
      ) = ARRAY['hash_archivo']
    LIMIT 1;

    IF v_old_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE comprobante_transferencia DROP CONSTRAINT %I', v_old_constraint);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'comprobante_transferencia'::regclass
          AND conname = 'uq_comprobante_factura_hash'
    ) THEN
        ALTER TABLE comprobante_transferencia
            ADD CONSTRAINT uq_comprobante_factura_hash UNIQUE (factura_id, hash_archivo);
    END IF;
END $$;

COMMIT;
