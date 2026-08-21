# Projections

This directory is reserved for shared denormalized read-model types assembled from multiple
rows. A projection describes the combined shape; database access and authorization remain in
`apps/api`, while conversion to UI-facing output belongs in `mappers/` when shared.

Do not duplicate single-table shapes from `rows/` or UI contracts from `vm/` here.
