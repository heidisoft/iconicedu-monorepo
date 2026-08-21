# Mappers

This directory owns pure, framework-neutral conversions between shared contracts, most
commonly database-facing `rows/` and UI-facing `vm/` types. Mappers must not perform I/O,
authorization, validation, logging, or app-specific orchestration.
