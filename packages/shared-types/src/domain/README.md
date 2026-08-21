# Domain types

This directory owns framework-neutral business types shared by more than one app. Use it
for concepts such as state transitions and domain policies that are neither database rows,
API payloads, nor UI view models.

Do not add app-specific business logic or speculative types. Keep a type in its owning app
until a real cross-app contract exists.
