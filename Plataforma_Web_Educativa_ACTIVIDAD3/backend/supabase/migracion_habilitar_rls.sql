/* =============================================================================
   Educar para Transformar - Migración: habilitar Row-Level Security (RLS)
   -----------------------------------------------------------------------------
   Supabase alertó que las tablas del esquema public son accesibles vía su API
   REST autogenerada (PostgREST) por CUALQUIERA que tenga la URL del proyecto
   y la clave "anon" (pública por diseño), porque ninguna tabla tenía RLS
   habilitado: se podía leer, editar o borrar cualquier dato sin pasar por el
   backend ni por ningún login.

   Esta app NUNCA usa la API REST de Supabase ni la clave "anon": el backend
   habla con Postgres directo (DATABASE_URL, rol dueño de las tablas) y con
   Supabase Storage usando la service_role key (que ignora RLS por diseño).
   Por eso la solución correcta es simplemente ENABLE ROW LEVEL SECURITY en
   todas las tablas, sin agregar ninguna policy: eso bloquea por completo el
   acceso vía la API pública (roles anon/authenticated) y no afecta en nada
   al backend, que sigue conectándose como dueño de las tablas.

   Es idempotente: se puede correr más de una vez.
   Ejecución: pegar en el SQL Editor de Supabase y correr.
   ============================================================================= */

BEGIN;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

COMMIT;
