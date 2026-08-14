# Security Policy

## Supported Versions

| Version        | Supported |
| -------------- | --------- |
| `main` branch  | Yes       |
| Older branches | No        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability — especially one involving user data, authentication, RLS bypass, or anything affecting children's data — please report it responsibly.

### How to report

Use GitHub's private vulnerability reporting flow from the repository's **Security** tab. If private reporting is unavailable, contact a repository maintainer or organization owner privately and ask for a secure reporting channel. Do not include vulnerability details in a public issue.

Include as much of the following as possible:

- Type of vulnerability (e.g. SQL injection, auth bypass, data exposure)
- Affected component (`apps/web`, `apps/mobile`, `apps/api`, Supabase RLS)
- Steps to reproduce
- Potential impact
- Any suggested remediation

### What to expect

- **Acknowledgement** within 48 hours
- **Status update** within 5 business days
- We will work with you to understand the scope, patch it, and disclose responsibly

We ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Not access, modify, or delete data belonging to other users during testing
- Not perform denial-of-service testing

## Security considerations

This platform handles data for minors (children in an education context). Any vulnerability affecting child data, guardian access controls, or role-based visibility is treated as **critical priority**.

Key areas of concern:

- **Row Level Security (RLS)** — Supabase RLS policies restrict data access per user role. Bypasses are critical.
- **Authentication** — Supabase Auth handles session tokens. Token leakage or auth bypass is critical.
- **Role boundaries** — Guardians, educators, advisors, and staff have different data access scopes. Cross-role data leakage is critical.
- **Service role key** — The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. It must never be exposed client-side.
