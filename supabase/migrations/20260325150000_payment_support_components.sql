-- P4: Payment system support components
-- 1. Transactions table for auditing and debugging raw webhook data.
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sepay_id BIGINT,
    gateway TEXT,
    transaction_date TIMESTAMPTZ,
    account_number TEXT,
    content TEXT,
    description TEXT,
    transfer_type TEXT,
    transfer_amount NUMERIC(12,2),
    accumulated NUMERIC(12,2),
    reference_code TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    order_id_prefix TEXT,
    amount_matched BOOLEAN,
    order_updated BOOLEAN,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_sepay_id ON public.transactions(sepay_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- 2. match_orders_by_id_prefix RPC
-- Provides a fast, indexed lookup for orders by their UUID prefix (cast to text).
CREATE OR REPLACE FUNCTION public.match_orders_by_id_prefix(p_prefix TEXT)
RETURNS TABLE (
    id UUID,
    status order_status,
    total_amount NUMERIC,
    total_price NUMERIC,
    payment_status TEXT,
    external_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT o.id, o.status, o.total_amount, o.total_price, o.payment_status, o.external_id
    FROM public.orders o
    WHERE o.id::text ILIKE p_prefix || '%'
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.match_orders_by_id_prefix(TEXT) TO service_role;
