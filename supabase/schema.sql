-- ========================================================
-- SCHEMA DRIVEHORA - SUPABASE (POSTGRESQL + REALTIME)
-- ========================================================

-- 1. Tabela de Perfis de Usuários (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client', 'driver', 'admin')),
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Passageiros / Clientes (clients)
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    cpf TEXT,
    phone TEXT NOT NULL,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    is_profile_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Motoristas Parceiros (drivers)
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    cpf TEXT,
    phone TEXT NOT NULL,
    cnh_number TEXT,
    cnh_category TEXT DEFAULT 'B',
    vehicle_brand TEXT,
    vehicle_model TEXT,
    vehicle_year TEXT,
    vehicle_plate TEXT,
    vehicle_color TEXT,
    cnh_url TEXT,
    crlv_url TEXT,
    selfie_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending_docs' CHECK (verification_status IN ('pending_docs', 'under_review', 'approved', 'rejected')),
    rating NUMERIC(3,2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT FALSE,
    current_lat NUMERIC(10,7),
    current_lng NUMERIC(10,7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Corridas (rides)
CREATE TABLE IF NOT EXISTS public.rides (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    driver_id TEXT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    origin_lat NUMERIC(10,7),
    origin_lng NUMERIC(10,7),
    dest_lat NUMERIC(10,7),
    dest_lng NUMERIC(10,7),
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

-- 5. Índices para consultas de alta performance
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_client_id ON public.rides (client_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers (verification_status);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON public.drivers (is_online);

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para MVP (leitura e escrita)
CREATE POLICY "Permitir leitura pública de perfis" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Permitir inserção de perfis" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização de perfis" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Permitir leitura pública de clientes" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Permitir inserção de clientes" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização de clientes" ON public.clients FOR UPDATE USING (true);

CREATE POLICY "Permitir leitura pública de motoristas" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Permitir inserção de motoristas" ON public.drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização de motoristas" ON public.drivers FOR UPDATE USING (true);

CREATE POLICY "Permitir leitura pública de corridas" ON public.rides FOR SELECT USING (true);
CREATE POLICY "Permitir criação de corridas" ON public.rides FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização de status de corridas" ON public.rides FOR UPDATE USING (true);

-- 7. Habilitar Supabase Realtime para sincronização instantânea
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
