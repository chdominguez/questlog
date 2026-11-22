CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- LedgerKind
  plan_delta INTEGER NOT NULL DEFAULT 0, topup_delta INTEGER NOT NULL DEFAULT 0,
  action TEXT,                              -- Action for spend/refund/free rows
  source TEXT NOT NULL,                     -- stripe_invoice | stripe_checkout | stripe_refund | rc | spend | refund | expire | free | admin
  source_id TEXT NOT NULL,
  ref TEXT, note TEXT, created_at TEXT NOT NULL,
  UNIQUE (source, source_id)
);
CREATE INDEX credit_ledger_user ON credit_ledger (user_id, created_at);
CREATE TABLE credit_balances (user_id TEXT PRIMARY KEY, plan INTEGER NOT NULL DEFAULT 0, topup INTEGER NOT NULL DEFAULT 0, plan_expires_at TEXT, free_courses_used INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE billing_customers (user_id TEXT PRIMARY KEY, stripe_customer_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE subscriptions (
  provider TEXT NOT NULL, external_id TEXT NOT NULL, user_id TEXT NOT NULL,
  store TEXT, status TEXT NOT NULL, period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, external_id)
);
CREATE INDEX subscriptions_user ON subscriptions (user_id);
CREATE TABLE webhook_events (provider TEXT NOT NULL, event_id TEXT NOT NULL, type TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY (provider, event_id));
