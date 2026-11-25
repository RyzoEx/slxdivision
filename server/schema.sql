CREATE SCHEMA IF NOT EXISTS slx_private;
REVOKE ALL ON SCHEMA slx_private FROM PUBLIC;
SET LOCAL search_path TO slx_private, pg_catalog;

CREATE TABLE IF NOT EXISTS slx_users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','operator','customer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS slx_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES slx_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS slx_sessions_expiry ON slx_sessions(expires_at);
CREATE TABLE IF NOT EXISTS slx_rate (
  key text PRIMARY KEY, count integer NOT NULL, until_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS slx_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL
);
INSERT INTO slx_settings (id, data) VALUES
  (1, '{"sales":false,"referral_bps":500,"reserve_bps":0,"fund_goal":null,"manufacturer_ready":false,"terms_ready":false}')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS slx_products (
  id text PRIMARY KEY, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS slx_collections (
  id text PRIMARY KEY, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS slx_manufacturers (
  id uuid PRIMARY KEY, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS slx_referrals (
  code text NOT NULL, mode text NOT NULL CHECK(mode IN ('test','live')),
  label text NOT NULL, bps integer NOT NULL CHECK(bps BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(mode,code)
);
CREATE TABLE IF NOT EXISTS slx_orders (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK(mode IN ('test','live')),
  user_id uuid REFERENCES slx_users(id),
  status text NOT NULL,
  items jsonb NOT NULL,
  delivery jsonb NOT NULL,
  financials jsonb NOT NULL DEFAULT '{}',
  manufacturing jsonb NOT NULL DEFAULT '{}',
  subtotal bigint,
  currency text NOT NULL DEFAULT 'UAH',
  referral_code text,
  referral_bps integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  closed_at timestamptz,
  refunded_at timestamptz,
  FOREIGN KEY(mode,referral_code) REFERENCES slx_referrals(mode,code)
);
ALTER TABLE slx_referrals ADD COLUMN IF NOT EXISTS fixed_amount bigint CHECK(fixed_amount >= 0);
ALTER TABLE slx_orders ADD COLUMN IF NOT EXISTS referral_fixed bigint CHECK(referral_fixed >= 0);
ALTER TABLE slx_orders ADD COLUMN IF NOT EXISTS advance bigint CHECK(advance >= 0);
ALTER TABLE slx_orders ADD COLUMN IF NOT EXISTS resolution jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS slx_balance_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mode text NOT NULL CHECK(mode IN ('test','live')),
  event_key text NOT NULL UNIQUE,
  actor_id uuid REFERENCES slx_users(id),
  order_id uuid REFERENCES slx_orders(id),
  kind text NOT NULL CHECK(kind IN ('completion','refund','transfer')),
  balance_delta bigint NOT NULL,
  reserve_delta bigint NOT NULL,
  fund_delta bigint NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS slx_balance_entries_mode_date ON slx_balance_entries(mode,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS slx_telegram_outbox (
  event_key text PRIMARY KEY,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS slx_orders_mode_created ON slx_orders(mode,created_at DESC);
CREATE INDEX IF NOT EXISTS slx_orders_user ON slx_orders(user_id,mode);
CREATE TABLE IF NOT EXISTS slx_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES slx_orders(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES slx_users(id),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS slx_referral_entries (
  order_id uuid NOT NULL REFERENCES slx_orders(id),
  kind text NOT NULL CHECK(kind IN ('credit','reversal')),
  amount bigint NOT NULL CHECK(amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_id,kind)
);
CREATE TABLE IF NOT EXISTS slx_interests (
  id uuid PRIMARY KEY, email text NOT NULL, product text NOT NULL,
  size text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '',
  delivery_key uuid NOT NULL,
  unsubscribe_hash text NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN ('pending','sending','sent','unsubscribed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE(email,product,size,color)
);
ALTER TABLE slx_interests ADD COLUMN IF NOT EXISTS delivery_key uuid;
UPDATE slx_interests SET delivery_key=id WHERE delivery_key IS NULL;
ALTER TABLE slx_interests ALTER COLUMN delivery_key SET NOT NULL;
CREATE TABLE IF NOT EXISTS slx_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES slx_users(id),
  action text NOT NULL, subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE slx_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_rate ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_referral_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_balance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE slx_telegram_outbox ENABLE ROW LEVEL SECURITY;
