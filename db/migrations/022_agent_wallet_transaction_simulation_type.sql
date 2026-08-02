ALTER TABLE agent_wallet_operations
  DROP CONSTRAINT IF EXISTS agent_wallet_operations_operation_type_check;

ALTER TABLE agent_wallet_operations
  ADD CONSTRAINT agent_wallet_operations_operation_type_check
  CHECK (
    operation_type IN (
      'personal_sign',
      'typed_data_sign',
      'transaction_sign',
      'transaction_simulation'
    )
  );
