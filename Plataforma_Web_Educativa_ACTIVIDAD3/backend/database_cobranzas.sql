/* Migración segura del módulo de cobranzas.
   Ejecutar en la base EducarParaTransformar desde SSMS/Azure Data Studio.
   No elimina datos ni tablas existentes. */

USE EducarParaTransformar;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* TarifaConcepto ya existe en el esquema actual; se amplía. */
IF COL_LENGTH('dbo.TarifaConcepto', 'descripcion') IS NULL
    ALTER TABLE dbo.TarifaConcepto ADD descripcion NVARCHAR(150) NULL;
GO

IF COL_LENGTH('dbo.TarifaConcepto', 'deporte_id') IS NULL
    ALTER TABLE dbo.TarifaConcepto ADD deporte_id INT NULL;
GO

IF COL_LENGTH('dbo.TarifaConcepto', 'transporte_id') IS NULL
    ALTER TABLE dbo.TarifaConcepto ADD transporte_id INT NULL;
GO

IF COL_LENGTH('dbo.TarifaConcepto', 'vigencia_hasta') IS NULL
    ALTER TABLE dbo.TarifaConcepto ADD vigencia_hasta DATE NULL;
GO

IF COL_LENGTH('dbo.TarifaConcepto', 'activo') IS NULL
    ALTER TABLE dbo.TarifaConcepto ADD activo BIT NOT NULL
        CONSTRAINT DF_TarifaConcepto_activo DEFAULT (1);
GO

IF OBJECT_ID('dbo.Factura', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Factura (
        id INT IDENTITY(1,1) NOT NULL,
        alumno_id INT NOT NULL,
        periodo DATE NOT NULL,
        fecha_emision DATE NOT NULL DEFAULT (CONVERT(DATE, GETDATE())),
        fecha_vencimiento DATE NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT ('Pendiente'),
        total DECIMAL(12,2) NOT NULL DEFAULT (0),
        saldo DECIMAL(12,2) NOT NULL DEFAULT (0),
        observaciones NVARCHAR(500) NULL,
        CONSTRAINT PK_Factura PRIMARY KEY (id),
        CONSTRAINT UQ_Factura_Alumno_Periodo UNIQUE (alumno_id, periodo),
        CONSTRAINT FK_Factura_Alumnos FOREIGN KEY (alumno_id)
            REFERENCES dbo.Alumnos(id),
        CONSTRAINT CK_Factura_Estado CHECK
            (estado IN ('Pendiente', 'Pago parcial', 'Pagada', 'Vencida', 'Anulada')),
        CONSTRAINT CK_Factura_Total CHECK (total >= 0),
        CONSTRAINT CK_Factura_Saldo CHECK (saldo >= 0),
        CONSTRAINT CK_Factura_Periodo CHECK (DAY(periodo) = 1),
        CONSTRAINT CK_Factura_Fechas CHECK (fecha_vencimiento >= fecha_emision)
    );
END;
GO

IF OBJECT_ID('dbo.FacturaDetalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FacturaDetalle (
        id INT IDENTITY(1,1) NOT NULL,
        factura_id INT NOT NULL,
        tarifa_concepto_id INT NOT NULL,
        descripcion NVARCHAR(200) NOT NULL,
        cantidad DECIMAL(10,2) NOT NULL DEFAULT (1),
        importe_unitario DECIMAL(12,2) NOT NULL,
        subtotal AS CONVERT(DECIMAL(12,2), cantidad * importe_unitario) PERSISTED,
        CONSTRAINT PK_FacturaDetalle PRIMARY KEY (id),
        CONSTRAINT FK_FacturaDetalle_Factura FOREIGN KEY (factura_id)
            REFERENCES dbo.Factura(id) ON DELETE CASCADE,
        CONSTRAINT FK_FacturaDetalle_TarifaConcepto FOREIGN KEY (tarifa_concepto_id)
            REFERENCES dbo.TarifaConcepto(id),
        CONSTRAINT UQ_FacturaDetalle_Concepto UNIQUE (factura_id, tarifa_concepto_id),
        CONSTRAINT CK_FacturaDetalle_Cantidad CHECK (cantidad > 0),
        CONSTRAINT CK_FacturaDetalle_Importe CHECK (importe_unitario >= 0)
    );
END;
GO

IF OBJECT_ID('dbo.ComprobanteTransferencia', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ComprobanteTransferencia (
        id INT IDENTITY(1,1) NOT NULL,
        factura_id INT NOT NULL,
        nombre_archivo NVARCHAR(255) NOT NULL,
        ruta_archivo NVARCHAR(500) NULL,
        tipo_mime VARCHAR(100) NOT NULL,
        tamano_bytes BIGINT NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha_transferencia DATE NOT NULL,
        hash_archivo VARCHAR(128) NOT NULL,
        estado_verificacion VARCHAR(20) NOT NULL DEFAULT ('Pendiente'),
        observaciones NVARCHAR(500) NULL,
        fecha_carga DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ComprobanteTransferencia PRIMARY KEY (id),
        CONSTRAINT FK_ComprobanteTransferencia_Factura FOREIGN KEY (factura_id)
            REFERENCES dbo.Factura(id) ON DELETE CASCADE,
        CONSTRAINT UQ_ComprobanteTransferencia_Hash UNIQUE (hash_archivo),
        CONSTRAINT CK_ComprobanteTransferencia_Monto CHECK (monto > 0),
        CONSTRAINT CK_ComprobanteTransferencia_Tamano
            CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880),
        CONSTRAINT CK_ComprobanteTransferencia_Estado CHECK
            (estado_verificacion IN ('Pendiente', 'Aprobado', 'Rechazado'))
    );
END;
GO
