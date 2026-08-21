# Validators

This directory is reserved for runtime validation that is genuinely shared across API and
frontend boundaries. API-internal DTO validation remains in `apps/api`; do not add a shared
validator until at least two consumers need the same runtime contract.

Validators must stay framework-neutral and must not perform I/O or authorization.
