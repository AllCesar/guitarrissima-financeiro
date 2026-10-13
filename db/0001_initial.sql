-- Central Financeira Guitarríssima — esquema inicial para revisão.
-- NÃO EXECUTAR EM PRODUÇÃO. Executar somente em banco isolado de homologação.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS account_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES account_categories(id),
 code text UNIQUE, name text NOT NULL, kind text NOT NULL DEFAULT 'expense' CHECK(kind IN ('expense','investment','other')),
 is_postable boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true, legacy_code text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cost_centers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES cost_centers(id),
 code text UNIQUE, name text NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE, name text NOT NULL,
 external_event_id text, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS vendors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, tax_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS financial_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 account_type text NOT NULL CHECK(account_type IN ('bank','cash','card')),
 masked_identifier text, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS payment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL,
 description text NOT NULL, requester_ref text, vendor_id uuid REFERENCES vendors(id),
 estimated_cents bigint CHECK(estimated_cents >= 0), status text NOT NULL DEFAULT 'new',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS obligations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid REFERENCES payment_requests(id),
 vendor_id uuid REFERENCES vendors(id), description text NOT NULL,
 total_cents bigint NOT NULL CHECK(total_cents > 0), currency char(3) NOT NULL DEFAULT 'BRL',
 competence_date date NOT NULL, status text NOT NULL DEFAULT 'draft',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expense_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES obligations(id),
 category_id uuid NOT NULL REFERENCES account_categories(id),
 cost_center_id uuid REFERENCES cost_centers(id), project_id uuid REFERENCES projects(id),
 amount_cents bigint NOT NULL CHECK(amount_cents > 0)
);
CREATE TABLE IF NOT EXISTS installments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES obligations(id),
 installment_number int NOT NULL CHECK(installment_number > 0),
 due_date date NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents > 0),
 UNIQUE(obligation_id, installment_number)
);
CREATE TABLE IF NOT EXISTS payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), financial_account_id uuid NOT NULL REFERENCES financial_accounts(id),
 paid_at timestamptz NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents > 0),
 bank_reference text, status text NOT NULL DEFAULT 'confirmed',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_applications (
 payment_id uuid NOT NULL REFERENCES payments(id), installment_id uuid NOT NULL REFERENCES installments(id),
 amount_cents bigint NOT NULL CHECK(amount_cents > 0), PRIMARY KEY(payment_id,installment_id)
);
CREATE TABLE IF NOT EXISTS financial_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid REFERENCES vendors(id),
 document_number text, issue_date date, total_cents bigint CHECK(total_cents >= 0),
 private_object_key text NOT NULL, sha256 text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS obligation_documents (
 obligation_id uuid NOT NULL REFERENCES obligations(id), document_id uuid NOT NULL REFERENCES financial_documents(id),
 PRIMARY KEY(obligation_id,document_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id bigserial PRIMARY KEY, entity_type text NOT NULL, entity_id uuid NOT NULL,
 action text NOT NULL, actor_ref text, details jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obligations_competence ON obligations(competence_date);
CREATE INDEX IF NOT EXISTS idx_installments_due ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_allocations_project ON expense_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_allocations_center ON expense_allocations(cost_center_id);
COMMIT;
-- Invariantes de soma (alocações=obrigação; parcelas=obrigação; aplicações<=pagamento)
-- devem ser validadas por transações no backend antes de confirmar um lançamento.
