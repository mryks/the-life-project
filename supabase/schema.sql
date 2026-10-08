-- ==============================================================================
-- The Life Project — Supabase PostgreSQL Schema
-- Domain: Personal Finance Tracker
-- Single Source of Truth: financial_events
-- ==============================================================================

-- 1. Create the financial_events table
CREATE TABLE IF NOT EXISTS public.financial_events (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount BIGINT NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'refund')),
    category TEXT NULL,
    account_id TEXT NULL,
    source_account_id TEXT NULL,
    destination_account_id TEXT NULL,
    admin_fee BIGINT NULL CHECK (admin_fee IS NULL OR admin_fee >= 0),
    related_event_id TEXT NULL,
    within_day_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL, -- Soft-delete tombstone for multi-device deletion sync
    user_id TEXT NOT NULL DEFAULT 'single-user'
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_financial_events_date 
    ON public.financial_events(date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_type 
    ON public.financial_events(type);

CREATE INDEX IF NOT EXISTS idx_financial_events_account_id 
    ON public.financial_events(account_id);

CREATE INDEX IF NOT EXISTS idx_financial_events_updated_at 
    ON public.financial_events(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_deleted_at 
    ON public.financial_events(deleted_at)
    WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_events_user_id 
    ON public.financial_events(user_id);

-- 3. Automated updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_financial_events_updated_at ON public.financial_events;

CREATE TRIGGER trigger_financial_events_updated_at
BEFORE UPDATE ON public.financial_events
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Row Level Security (RLS)
ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

-- Single-user personal access policy
DROP POLICY IF EXISTS "Single-user personal full access" ON public.financial_events;

CREATE POLICY "Single-user personal full access"
ON public.financial_events
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Realtime Publication (Enables instant multi-device sync)
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_events;

-- 6. Unified Master PIN Security Vault
CREATE TABLE IF NOT EXISTS public.vault_security (
    id TEXT PRIMARY KEY DEFAULT 'master-vault',
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vault_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Single-user vault access" ON public.vault_security;

CREATE POLICY "Single-user vault access"
ON public.vault_security
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

