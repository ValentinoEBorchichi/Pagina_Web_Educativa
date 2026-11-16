/* =============================================================================
   Educar para Transformar - Migración: comprobante de pago numerado (RFM-05)
   -----------------------------------------------------------------------------
   El padre selecciona los ítems a pagar de una o varias facturas y el sistema
   emite un comprobante de pago numerado (NO es el comprobante de transferencia
   que después se sube como respaldo: es la constancia que el propio sistema
   genera con el detalle de lo que el padre dice que va a pagar).

     comprobante_pago       cabecera: número único, alumno, total, fecha
     comprobante_pago_item  renglón por cada factura_detalle incluido

   Es idempotente: se puede correr más de una vez.
   Ejecución: pegar en el SQL Editor de Supabase y correr, después de
   migracion_cuotas.sql.
   ============================================================================= */

BEGIN;

CREATE SEQUENCE IF NOT EXISTS comprobante_pago_numero_seq START 1;

CREATE TABLE IF NOT EXISTS comprobante_pago (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero         VARCHAR(20)   NOT NULL UNIQUE,
    alumno_id      INTEGER       NOT NULL REFERENCES alumnos (id),
    padre_id       INTEGER       NOT NULL,
    total          DECIMAL(12,2) NOT NULL,
    fecha_emision  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_comprobante_pago_total CHECK (total > 0)
);

CREATE TABLE IF NOT EXISTS comprobante_pago_item (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comprobante_pago_id  INTEGER       NOT NULL REFERENCES comprobante_pago (id) ON DELETE CASCADE,
    factura_detalle_id   INTEGER       NOT NULL REFERENCES factura_detalle (id),
    descripcion          VARCHAR(200)  NOT NULL,
    subtotal             DECIMAL(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_comprobante_pago_alumno_id ON comprobante_pago (alumno_id);
CREATE INDEX IF NOT EXISTS ix_comprobante_pago_item_cp_id ON comprobante_pago_item (comprobante_pago_id);

COMMIT;
