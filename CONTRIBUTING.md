# Contributing

## Dev setup

```bash
npm install
npm run build --workspace @clndr-pro/sdk --workspace @clndr-pro/react
npm run typecheck
```

## Running the example

```bash
cd examples/nextjs
cp .env.example .env.local   # fill in keys
npm run dev
```

## Releasing

1. Bump versions in `packages/sdk/package.json` and `packages/react/package.json`
   (keep them in sync; `@clndr-pro/react` depends on a specific `@clndr-pro/sdk` version).
2. `git tag v0.X.Y && git push --tags`
3. The `Publish` workflow publishes both packages through npm trusted publishing
   (with provenance). See PUBLISHING.md § 2.3 for the one-time npm setup.
