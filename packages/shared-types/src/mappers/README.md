# Mappers

This directory is reserved for shared mapper contract types and ownership documentation.
Database-facing inputs belong in `rows/`, and UI-facing outputs belong in `vm/`.

Executable, framework-neutral mapping helpers belong in `packages/utils`. Authorization,
visibility, validation, and other business rules belong in `apps/api`. Do not add executable
mappers or policy decisions to this package.
