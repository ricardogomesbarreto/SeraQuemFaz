-- Retain payment identities across retry attempts, including superseded attempts.
CREATE TABLE sqf_billing_payment_attempts (
  payment_id VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  invoice_id VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(payment_id),
  CONSTRAINT sqf_attempt_invoice_fk FOREIGN KEY(invoice_id) REFERENCES sqf_billing_invoices(mp_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT INTO sqf_billing_payment_attempts(payment_id,invoice_id)
SELECT mp_payment_id,mp_invoice_id FROM sqf_billing_invoices WHERE mp_payment_id IS NOT NULL;
