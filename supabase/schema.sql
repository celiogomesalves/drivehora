-- ========================================================
-- SCHEMA COMPLETO DRIVEHORA - SUPABASE (POSTGRESQL + REALTIME)
-- SCRIPT IDEMPOTENTE (PODE SER EXECUTADO MÚLTIPLAS VEZES SEM ERROS)
-- ========================================================

-- 1. Tabela de Perfis de Usuários (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client', 'driver', 'admin')),
    phone TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Passageiros / Clientes (clients)
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
    total_earnings NUMERIC(10,2) DEFAULT 0.00,
    is_online BOOLEAN DEFAULT FALSE,
    current_lat NUMERIC(10,7),
    current_lng NUMERIC(10,7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Corridas (rides)
CREATE TABLE IF NOT EXISTS public.rides (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT,
    driver_id TEXT,
    driver_name TEXT,
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

-- 5. Tabela de Avaliações (ratings)
CREATE TABLE IF NOT EXISTS public.ratings (
    id TEXT PRIMARY KEY,
    ride_id TEXT NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    from_user_id TEXT NOT NULL REFERENCES public.profiles(id),
    to_user_id TEXT NOT NULL REFERENCES public.profiles(id),
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela de Transações Financeiras (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    ride_id TEXT NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    driver_id TEXT,
    total_amount NUMERIC(10,2) NOT NULL,
    platform_fee NUMERIC(10,2) NOT NULL,
    driver_net_amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'credit_card', 'wallet')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Índices para Otimização de Consultas
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_client_id ON public.rides (client_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers (verification_status);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON public.drivers (is_online);

-- 8. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Remove se já existir e recria com segurança)
DROP POLICY IF EXISTS "Permitir tudo em perfis" ON public.profiles;
CREATE POLICY "Permitir tudo em perfis" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em clientes" ON public.clients;
CREATE POLICY "Permitir tudo em clientes" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em motoristas" ON public.drivers;
CREATE POLICY "Permitir tudo em motoristas" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em corridas" ON public.rides;
CREATE POLICY "Permitir tudo em corridas" ON public.rides FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em avaliações" ON public.ratings;
CREATE POLICY "Permitir tudo em avaliações" ON public.ratings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em transações" ON public.transactions;
CREATE POLICY "Permitir tudo em transações" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

-- 9. Habilitar Supabase Realtime (Com verificação se a tabela já foi adicionada)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;
