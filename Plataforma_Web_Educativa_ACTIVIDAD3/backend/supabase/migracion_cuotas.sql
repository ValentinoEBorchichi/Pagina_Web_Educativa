/* =============================================================================
   Educar para Transformar - Migración: planes de pago en cuotas
   -----------------------------------------------------------------------------
   Agrega el esquema de cuotas sobre una base que YA tiene schema.sql aplicado:

     plan_pago           catálogo de planes (cantidad de cuotas + recargo %)
     factura.plan_pago_id  plan elegido para la factura (NULL = todavía no eligió)
     factura_cuota       cuotas generadas al elegir el plan; cada cuota puede
                         quedar atada a UN comprobante de transferencia

   Es idempotente: se puede correr más de una vez (y también sobre una base
   creada con el schema.sql actualizado, que ya incluye estas tablas).

   Reglas que implementa el backend (financiero.controller.js):
     - Al elegir el plan, el recargo se suma a factura.total y factura.saldo
       (así total - saldo sigue siendo "lo pagado") y el saldo se reparte en
       cantidad_cuotas cuotas; la diferencia de centavos va en las primeras.
     - Vencimiento de la cuota 1: el mayor entre factura.fecha_vencimiento y
       hoy; las siguientes, de a un mes.
     - Al aprobar un comprobante atado a una cuota, la cuota pasa a 'Pagada';
       al rechazarlo la cuota sigue 'Pendiente' (se puede volver a subir).

   Ejecución: pegar en el SQL Editor de Supabase y correr.
   ============================================================================= */

BEGIN;

-- =============================================================================
-- Planes de pago
-- =============================================================================

CREATE TABLE IF NOT EXISTS plan_pago (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre           VARCHAR(50)   NOT NULL UNIQUE,
    cantidad_cuotas  SMALLINT      NOT NULL,
    recargo_pct      DECIMAL(5,2)  NOT NULL DEFAULT 0,
    activo           BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_plan_pago_cuotas CHECK (cantidad_cuotas BETWEEN 1 AND 24),
    CONSTRAINT ck_plan_pago_recargo CHECK (recargo_pct >= 0)
);

-- =============================================================================
-- Factura: plan elegido
-- =============================================================================

ALTER TABLE factura ADD COLUMN IF NOT EXISTS plan_pago_id INTEGER NULL REFERENCES plan_pago (id);

CREATE INDEX IF NOT EXISTS ix_factura_plan_pago_id ON factura (plan_pago_id);

-- =============================================================================
-- Cuotas de la factura
-- =============================================================================

CREATE TABLE IF NOT EXISTS factura_cuota (
    id                            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    factura_id                    INTEGER       NOT NULL REFERENCES factura (id) ON DELETE CASCADE,
    plan_pago_id                  INTEGER       NOT NULL REFERENCES plan_pago (id),
    numero_cuota                  SMALLINT      NOT NULL,
    monto                         DECIMAL(12,2) NOT NULL,
    vencimiento                   DATE          NOT NULL,
    estado                        VARCHAR(20)   NOT NULL DEFAULT 'Pendiente',
    comprobante_transferencia_id  INTEGER       NULL REFERENCES comprobante_transferencia (id),
    CONSTRAINT uq_factura_cuota_numero UNIQUE (factura_id, numero_cuota),
    CONSTRAINT uq_factura_cuota_comprobante UNIQUE (comprobante_transferencia_id),
    CONSTRAINT ck_factura_cuota_estado CHECK (estado IN ('Pendiente', 'Pagada', 'Vencida', 'Anulada')),
    CONSTRAINT ck_factura_cuota_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS ix_factura_cuota_factura_id ON factura_cuota (factura_id);

-- =============================================================================
-- Planes iniciales (editables/desactivables por el admin desde la web).
-- ON CONFLICT: no pisa los que el admin ya haya creado o modificado.
-- =============================================================================

INSERT INTO plan_pago (nombre, cantidad_cuotas, recargo_pct) VALUES
    ('Pago único', 1, 0),
    ('3 cuotas',   3, 5),
    ('6 cuotas',   6, 10)
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
