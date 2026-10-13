# Side Quest Ledger

A shared quest board for small adventures, creative challenges, and reasons to leave the house.

Live site: https://side-quest-ledger.dreamycedar64.chatgpt.site

## Features

- Multiple people can join the same quest with independent completion status.
- A one-time name prompt remembers the visitor in browser localStorage.
- New quests record and display their creator.
- Categories, rewards, XP, and active/completed filters.
- Shared password access and an aubergine/teal interface.

## Stack

React, TypeScript, Vinext/Vite, Cloudflare Workers, D1, and Drizzle.

## Development

Requires Node.js 22.13 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Configure `SITE_PASSWORD` and `SESSION_SECRET` as runtime environment variables. Keep their values out of Git. The D1 binding is `DB`; schema and migrations live in `db/` and `drizzle/`.

```sh
pnpm db:generate
pnpm build
```

The project retains its Sites hosting manifest and build integration. Local database migrations and production publication are separate operations; hosting applies committed migrations during deployment.

Generated archives, dependency folders, environment files, and local runtime state are excluded from this repository.

## Engineering documentation

- [State of the union](STATE_OF_THE_UNION.md): implemented features, deployment provenance, evidence, and open decisions.
- [Formal system model](docs/FORMAL_MODEL.md): architecture, data, API transitions, invariants, failures, and proposed ownership model.
- [Threat model](docs/THREAT_MODEL.md): trust boundaries, ranked risks, mitigations, and security acceptance criteria.
- [Changelog](CHANGELOG.md): delivered changes and publication history.
- [Agent instructions](AGENTS.md): codebase constraints and decision provenance.
- [Executable model](docs/model/README.md): offline state exploration and expected security counterexamples.

The current app is a shared-access prototype, not a hardened multi-user security boundary. Display names do not establish individual identity or ownership. Read the threat model before using it for sensitive data or expanding access.
