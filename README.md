# Proper Fullscreen

Removes **baked-in letterbox bars** so scope films fill an ultrawide display.

A 2.39:1 film encoded inside a 16:9 container has its black bars in the *pixel data*. No layout
change can remove them — to the browser the frame simply is 16:9. This extension scales the decoded
frame until the picture fills the container, pushing the encoded bars off-screen, without ever
cropping real image.

**Verified working on YouTube, Disney+, Netflix and Prime Video** (Firefox / Linux, 3440x1440).

## Install (temporary add-on, for development)

```sh
pnpm install
pnpm build            # esbuild -> dist/
```

Then in Firefox: `about:debugging` -> **This Firefox** -> **Load Temporary Add-on…** -> pick
`manifest.json` in this directory.

`pnpm dev` rebuilds on change; hit **Reload** in `about:debugging` to pick the new bundle up.

## Use

Open the extension's popup on a supported site. It shows the decoded frame size, the scale in
effect, and which axis is binding. Pick the film's aspect ratio from the presets, or type a custom
one (`2.39` or `21:9`).

On **YouTube** the video is not DRM-protected, so **Auto-detect** samples six frames, measures the
bars directly, and snaps to the nearest preset. On the DRM sites (Disney+, Netflix, Prime Video)
pixel readback is silently zeroed by Widevine, so the ratio has to be chosen by hand — 2.39 is
right for most scope films.

## How it works

```
scale = clamp(min(containerH * PICTURE_AR / pictW, containerW / pictW), 1, ∞)
```

Three things make this work where other extensions break:

1. **Clamped on both axes.** Scaling to fill height alone crops the sides whenever the container is
   narrower than the film — on YouTube's default view that discards 25.6% of the image width. When
   there is no room to grow, the scale stays at 1 and the bars are left alone, which is correct:
   they cannot be removed there without losing picture.
2. **A stylesheet rule, not inline styles.** Every player owns the video's `style` attribute and
   rewrites it on resize. A rule in `<head>` is outside their diff.
3. **The player's own transform is composed with, never replaced.** Netflix centres its video with
   `translate(-50%, -50%)`; overriding `transform` outright throws the picture into the
   bottom-right corner. Transforms that already scale or rotate are refused rather than guessed at.

The scale is recomputed on every layout change — a static value is wrong the moment the view mode
changes.

## Findings

Per-site DOM structure, measurements and gotchas are in [`docs/findings/`](docs/findings/):

| | |
|---|---|
| [`00-methodology.md`](docs/findings/00-methodology.md) | Proving bars are baked in without pixel access; the scaling maths |
| [`10-disneyplus.md`](docs/findings/10-disneyplus.md) | Two `<video>` elements, one hidden; DRM readback returns black without throwing |
| [`20-youtube.md`](docs/findings/20-youtube.md) | Three view modes; detection by pixel sampling; the side-cropping bug |
| [`40-primevideo.md`](docs/findings/40-primevideo.md) | No clipping ancestor at all; a fullscreen class that lies |
| [`50-netflix.md`](docs/findings/50-netflix.md) | The centring transform; padded vs native-AR masters |
| [`30-aspect-presets.md`](docs/findings/30-aspect-presets.md) | The preset list and why detection snaps to it |

## Releases and distribution

Firefox requires **Mozilla** to sign every extension, whether it is listed on addons.mozilla.org or
hosted here — there is no self-signing path. So a GitHub release can carry one of two things:

- **unsigned `.zip`** (default) — usable via `about:debugging` → Load Temporary Add-on, or as an
  upload to AMO. Firefox release/beta builds will not install it directly.
- **signed `.xpi`** — produced automatically when the `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`
  repository secrets are set. The release workflow then asks AMO to sign on the *unlisted* channel
  and attaches an installable file.

Tagging `v*` runs the release workflow. Because the extension is bundled with esbuild, any AMO
submission must include reproducible build instructions — those are in
[`docs/BUILD.md`](docs/BUILD.md).

## Development

```sh
pnpm check      # lint + typecheck + tests
pnpm test       # solver regression tests
pnpm package    # -> web-ext-artifacts/*.zip
```

Build details and the exact toolchain versions: [`docs/BUILD.md`](docs/BUILD.md).

The tests pin the solver against **real measurements** taken from the live players. If one breaks,
it breaks a case that was verified by eye in a browser.

Strict TypeScript throughout (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), bundled by
esbuild into two classic IIFE bundles because content scripts cannot be ES modules.
