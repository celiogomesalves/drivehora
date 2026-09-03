-- ========================================================
-- SCHEMA DRIVEHORA - SUPABASE (POSTGRESQL + REALTIME)
-- ========================================================

-- 1. Criar tabela de corridas (rides)
CREATE TABLE IF NOT EXISTS public.rides (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    driver_id TEXT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    hours INTEGER NOT NULL DEFAULT 1 CHECK (hours >= 1 AND hours <= 24),
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    commission NUMERIC(10,2) NOT NULL DEFAULT 7.50,
    driver_net NUMERIC(10,2) NOT NULL DEFAULT 42.50,
    status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'accepted', 'in_progress', 'finished', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_client_id ON public.rides (client_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides (created_at DESC);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para MVP (leitura e escrita anônima/autenticada)
CREATE POLICY "Permitir leitura pública de corridas" 
    ON public.rides FOR SELECT 
    USING (true);

CREATE POLICY "Permitir criação de corridas" 
    ON public.rides FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir atualização de status de corridas" 
    ON public.rides FOR UPDATE 
    USING (true);

-- 4. Habilitar Supabase Realtime para sincronização instantânea
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
