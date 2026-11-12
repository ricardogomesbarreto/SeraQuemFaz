-- A payment must not fund multiple invoices. Existing duplicates must be reconciled before applying.
ALTER TABLE sqf_billing_invoices
  MODIFY mp_payment_id VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD CONSTRAINT sqf_billing_invoices_payment_unique UNIQUE (mp_payment_id);
