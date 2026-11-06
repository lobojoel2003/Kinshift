# Contributing to Kinshift

Thank you for helping families share the work of caring for someone. Bug
reports, ideas, documentation and code are all welcome.

## Ground rules

- Be kind. See the [code of conduct](CODE_OF_CONDUCT.md).
- Never put real health information in issues, pull requests or test data.
- Report security problems privately (see [SECURITY.md](SECURITY.md)).

## Development setup

You need Node.js 22 or newer.

```bash
git clone https://github.com/lobojoel2003/Kinshift.git
cd Kinshift
npm install
npm run dev
```

Open http://localhost:3000 and create the first account. Data goes to `./data`.

To start with a realistic family instead of an empty app:

```bash
DATA_DIR=./demo-data npm run db:seed-demo
DATA_DIR=./demo-data npm run dev
```

Then sign in as `maya@example.com` with the password `kinshift-demo`.

## Project layout

| Path                   | What lives there                                                    |
| ---------------------- | ------------------------------------------------------------------- |
| `src/app`              | Pages, layouts and Server Actions (Next.js App Router)              |
| `src/components`       | Shared UI. `ui/` holds the design-system primitives                 |
| `src/lib`              | Domain logic: scheduling, coverage, encryption, auth, notifications |
| `src/lib/db/schema.ts` | Database schema (Drizzle ORM + SQLite)                              |
| `drizzle/`             | Generated SQL migrations, applied automatically on start-up         |
| `tests/`               | Vitest unit and integration tests                                   |
| `e2e/`                 | Playwright end-to-end tests                                         |
| `scripts/`             | Demo data, icon generation, screenshots, e2e server                 |

## Checks

Run these before opening a pull request. CI runs the same ones.

```bash
npm run validate     # lint, type check, unit + integration tests, formatting
npm run build        # production build
npm run test:e2e     # end-to-end tests against the production build
```

`npm run format` fixes formatting.

## Database changes

1. Edit `src/lib/db/schema.ts`.
2. Run `npm run db:generate` and commit the new file in `drizzle/`.
3. Migrations run automatically when the server starts.

Anything that describes someone's health (names of medications, notes,
readings, appointment details) must be stored encrypted with the circle's
`CircleCipher`. Structural data such as times and ids can stay in plaintext.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
`fix:`, `docs:`, `test:`, `chore:`, `refactor:`. Add user-facing changes to the
“Unreleased” section of [CHANGELOG.md](CHANGELOG.md).

## Releasing (maintainers)

Kinshift follows [Semantic Versioning](https://semver.org/).

1. Move the “Unreleased” notes in `CHANGELOG.md` under a new version heading.
2. Run `npm run release:patch` (or `:minor` / `:major`). This bumps
   `package.json`, commits and creates the `vX.Y.Z` tag.
3. `git push --follow-tags`.

The Release workflow then checks that the tag matches `package.json`, runs the
full test suite, publishes a multi-arch Docker image to
`ghcr.io/lobojoel2003/kinshift` (tags `X.Y.Z`, `X.Y`, `X`, `latest`) with an SBOM
and provenance attestation, builds a Node.js bundle and creates the GitHub
release with notes from the changelog. The GitHub Actions run number becomes
the build number shown in the app.
