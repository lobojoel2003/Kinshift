# Changelog

All notable changes to Kinshift are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-06

The first release of Kinshift, the family caregiver hub.

### Added

- **Care circles** for one person being cared for, with organizer, caregiver and
  read-only viewer roles, and expiring invite links that family can open on any
  phone.
- **Shared medication checklist.** Scheduled doses grouped by time of day, one
  tap to mark a dose given or skipped, and a database-level guarantee that the
  same dose cannot be logged twice, even when two people tap at once.
- **As-needed medications** with minimum spacing and a daily maximum. Giving a
  dose outside the limits needs a reason and alerts the family.
- **Medication supply tracking** with refill warnings, 7- and 30-day adherence,
  and a full dose history per medication.
- **Care schedule.** Weekly view of who is on duty, uncovered hours inside the
  circle's coverage window, open shifts anyone can claim, “I’ll cover” for gaps,
  recurring weekly shifts, overnight shifts and hours per person.
- **Appointments** with clash detection, a confirmation step when two visits
  overlap, and a prompt when nobody is going along.
- **Care journal** for handoff notes, observations, vitals (blood pressure,
  pulse, temperature, SpO₂, glucose, weight) and incidents, with mood tracking.
- **Tasks** for errands, with due dates and assignees.
- **Care profile** for allergies, conditions, care team, emergency contacts and
  daily routines, plus a printable **emergency card**.
- **Today dashboard** showing who is on duty, doses due or missed, appointment
  clashes, refills, the latest handoff, tasks and recent activity. Screens
  refresh automatically so everyone sees the same thing.
- **Web push notifications** for doses due, missed doses, shifts, open shifts,
  appointments, handoffs and incidents, with per-person preferences and
  discreet wording by default.
- **Installable progressive web app** with an offline notice and no health data
  kept in the browser cache.
- **Encryption at rest** (AES-256-GCM, a data key per circle, secret rotation
  support), scrypt password hashing, hashed session and invite tokens, rate
  limiting and a nonce-based Content Security Policy.
- **Data export** of a whole circle as JSON, and permanent deletion of circles
  and accounts.
- **Self-hosting:** one Docker image (amd64 and arm64) with a SQLite database,
  automatic migrations, a health check, Docker Compose file and a one-click
  Render blueprint.
- **Demo data** script, unit, integration and end-to-end test suites, and CI/CD
  that publishes versioned images and releases with build numbers.

[Unreleased]: https://github.com/lobojoel2003/Kinshift/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lobojoel2003/Kinshift/releases/tag/v1.0.0
