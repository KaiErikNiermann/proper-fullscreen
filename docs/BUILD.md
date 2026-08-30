# Build instructions

These instructions exist so that a reviewer — or anyone else — can reproduce `dist/` exactly from
the sources in this repository. AMO requires this because the extension is bundled with
[esbuild](https://esbuild.github.io/), and module bundlers count as generated code.

Nothing here is minified or obfuscated. The bundler concatenates the TypeScript modules under
`src/` into two classic IIFE scripts and strips types; the output remains readable, and
`.map` sourcemaps are emitted alongside it.

## Environment

Verified on the AMO default reviewer environment and on the developer's machine:

| | Reviewer default | Developer machine |
|---|---|---|
| OS | Ubuntu 24.04 LTS | Arch Linux (rolling) |
| Node | 24.x | 26.4.0 |
| Package manager | **pnpm 10.32.1** (see below) | pnpm 10.32.1 |

The project uses **pnpm**, not npm. The exact version is pinned in `package.json` via the
`packageManager` field, and `pnpm-lock.yaml` is committed. Node's bundled Corepack will install
that precise version for you — no global install and no network guesswork:

```sh
corepack enable
```

If Corepack is unavailable, `npm install -g pnpm@10.32.1` is equivalent.

All build tooling is open source and runs locally. No web-based tools are involved.

## Build

From a clean checkout:

```sh
corepack enable                 # provisions pnpm 10.32.1 from package.json
pnpm install --frozen-lockfile  # installs exactly what pnpm-lock.yaml pins
pnpm build                      # runs build.js -> dist/
```

`pnpm build` executes `build.js`, which:

1. copies `src/popup/popup.html` and `src/popup/popup.css` into `dist/`, then
2. runs esbuild twice, with `bundle: true`, `format: 'iife'`, `target: 'firefox115'`,
   `sourcemap: true` and **no minification**:
   - `src/content.ts` -> `dist/content.js`
   - `src/popup/popup.ts` -> `dist/popup.js`

The full esbuild configuration is in [`build.js`](../build.js) — it is 30 lines and has no
conditional behaviour beyond a `--watch` flag used during development.

### Files referenced by `manifest.json`

| Manifest entry | Produced by |
|---|---|
| `dist/content.js` | esbuild, from `src/content.ts` and its imports |
| `dist/popup.html` | copied verbatim from `src/popup/popup.html` |
| `dist/popup.js` | esbuild, from `src/popup/popup.ts` and its imports |
| `dist/popup.css` | copied verbatim (referenced by `popup.html`) |
| `icons/icon.svg` | committed source, not generated |

`dist/` is deliberately **not** committed; it is reproduced by the command above.

## Verify

```sh
pnpm check     # eslint + tsc --noEmit + node --test
```

- **lint** — ESLint 9 flat config with `typescript-eslint` `strictTypeChecked`, plus the
  `sonarjs`, `unicorn` and `security` plugins.
- **typecheck** — `tsc --noEmit` in strict mode, with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- **test** — `node --test test/*.test.ts`, run directly via Node's native type stripping
  (requires Node >= 22.18). Fixtures are real measurements taken from the live players.

## Package

```sh
pnpm package   # web-ext build --overwrite-dest -> web-ext-artifacts/*.zip
```

This is what CI attaches to a GitHub release. It contains `manifest.json`, `dist/` and `icons/`
only — see the `ignoreFiles` list in `web-ext-config.mjs`.
