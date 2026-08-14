# Documentation Hub

## Purpose

This is the canonical index for engineering documentation in the IconicEdu monorepo.

## Intended Audience

Internal engineers, operators, and AI assistants.

## Last Updated

2026-08-14

## Related Docs

- [Repo README](../README.md)
- [Contributing](../CONTRIBUTING.md)
- [AI Entry File](../AGENTS.md)

## Start Here

### New Engineer

- [Local Setup](getting-started/setup.md)
- [Development Workflow](getting-started/development-workflow.md)
- [Contributing](../CONTRIBUTING.md)
- [Architecture Overview](architecture/overview.md)
- [Best Practices](standards/best-practices.md)

### Feature Developer

- [Architecture Overview](architecture/overview.md)
- [Shared Packages](architecture/packages.md)
- [Best Practices](standards/best-practices.md)
- [Architecture Decisions](decisions/README.md)

### Mobile Engineer

- [Local Setup](getting-started/setup.md)
- [Development Workflow](getting-started/development-workflow.md)
- [Architecture Overview](architecture/overview.md)
- [Deployment](operations/deployment.md)

### Operator

- [Deployment](operations/deployment.md)
- [Reminders Runbook](operations/reminders.md)
- [Local Event Pipeline Testing](operations/local-event-pipeline-testing.md)

### AI Agent

- [Root AGENTS Entry](../AGENTS.md)
- [Canonical AI Guidance](internal/ai/agents.md)

## Sections

### Getting Started

- [Setup](getting-started/setup.md)
- [Development Workflow](getting-started/development-workflow.md)
- [Contributing](../CONTRIBUTING.md)

### Architecture

- [Overview](architecture/overview.md)
- [Shared Packages](architecture/packages.md)
- [Database](architecture/database.md)
- [Assessments](architecture/assessments.md)
- [Diagrams](architecture/diagrams.md)
- [Swimlanes](architecture/swimlanes.md)
- [Activity Feed Contract](architecture/activity-feed.md)
- [Activity Feed Variants](architecture/activity-feed-variants.md)
- [Event Pipeline Scalability](architecture/event-pipeline-scalability.md)

### Standards

- [Best Practices](standards/best-practices.md)

### Operations

- [Deployment](operations/deployment.md)
- [Reminders Runbook](operations/reminders.md)
- [Local Event Pipeline Testing](operations/local-event-pipeline-testing.md)
- [Push Notifications](operations/push-notifications.md)
- [Push Notification Catalog](operations/push-notification-catalog.md)
- [Schedule Event Flow](operations/schedule-event-flow.md)

### Testing

- [Mobile Manual Test Plan](testing/mobile-test-plan.md)
- [Web Playwright Guide](../apps/web/e2e/README.md)

### Decisions

- [ADR Index](decisions/README.md)

### Internal AI

- [AI Guidance](internal/ai/agents.md)

## Documentation Maintenance

- Update docs in the same PR as the behavior they describe.
- Treat tracked configuration, package scripts, migrations, and workflow files as the source of truth for exact values.
- Use repository-relative links; never commit machine-specific absolute paths.
- Change `Last Updated` only after reviewing the complete document.
- Add new canonical pages to this hub and keep subsystem runbooks beside the code they operate.
- Track planned work and point-in-time audit findings in GitHub issues instead of `docs/todos` or `docs/reports`.
- Remove superseded pages and their inbound links rather than keeping an unlabeled archive in the current documentation tree.
