# Prime Video (DRM) - verified working in real fullscreen

Title tested: *Project Hail Mary*, `www.amazon.de/gp/video/detail/B0GHY3SHWJ`, Firefox/Linux.
**Status: confirmed working by user in real fullscreen.**

## Host matching

Served from **`www.amazon.de`**, not `primevideo.com`. Matching only `primevideo.com` misses the
site entirely for most non-US users. Match `primevideo.com` *and* `amazon.<tld>`.

## Player structure

```
VIDEO                                     attrs: width="100%" height="100%" aria-hidden src
                                          NO class, NO inline style
DIV[tabindex]                             overflow: visible
DIV.atvwebplayersdk-video-surface .fk9ydtn   overflow: visible   <-- we add clipping here
DIV.f1prfwap                              overflow: visible
DIV#dv-web-player.dv-player-fullscreen    overflow: visible, position: fixed
BODY                                      overflow: hidden, height 4264.6  <-- scroll host, NOT a clipper
HTML
```

- The `<video>` has **no class and no inline style**; Amazon sizes it with HTML `width`/`height`
  **attributes** set to `"100%"`. Selector must be scoped by an ancestor:
  `.atvwebplayersdk-video-surface video`.
- `fk9ydtn` / `f1prfwap` are generated hashes - never select on them. `atvwebplayersdk-*` is the
  stable SDK prefix.
- **Three `<video>` elements exist.** Only one has `videoWidth > 0`; another is the detail-page
  preview (2981.3 x 1083 at y=99), a third is 0x0. Requiring a decoded frame is mandatory.

## No clipping ancestor exists

Unlike YouTube (`#movie_player`) and Disney+ (`.btm-media-client`), **nothing in the Prime chain
clips**. The first `overflow: hidden` is `<body>` - which is the 4264px scroll host, not a
viewport-sized box. Feeding its height into the solver gives `scale 1.61` in windowed mode and the
scaled video paints straight over the page.

Two consequences:

1. The adapter declares `needsClip: '.atvwebplayersdk-video-surface'` and the engine emits
   `overflow: hidden !important` for it. Adding overflow to an *existing* player element is fine;
   injecting a wrapper element is what breaks players.
2. The generic clipping-ancestor walk now rejects scroll hosts
   (`height > innerHeight * 1.5`, or `body`/`documentElement`).

## DRM

`maxLuma: 0` - readback blocked, same as Disney+. Detection impossible; preset required.
Encoded frame **960 x 540 = exactly 16:9** (Widevine L3 cap on Firefox/Linux), letterbox baked in.

## Two fullscreen modes - and the class that lies

| state | `document.fullscreenElement` | `#dv-web-player` class | container | AR | scale |
|---|---|---|---|---|---|
| real fullscreen | **set** | `dv-player-fullscreen` | 2981.3 x 1248 | 2.3889 | **1.34375** |
| CSS "fullscreen" | **null** | `dv-player-fullscreen` | 1848.6 x 1072.9 | 1.7229 | **1.0** |
| CSS "fullscreen" | null | `dv-player-fullscreen` | 1796.6 x 1020.9 | 1.7598 | 1.0 |

**`dv-player-fullscreen` is present in both states.** It is not a fullscreen indicator; only
`document.fullscreenElement` distinguishes them.

### Real fullscreen - works

`PICTURE_AR = 2.39`, frame 1.77778 -> `sH 1.3444`, `sW 1.3437`, **scale 1.34375** (width-bound).
Picture 2981.3 x 1247.4 in a 2981.3 x 1248 container: **letterbar 0.3px, pillarbar 0**. Exact fill.

### CSS fullscreen - correctly refuses to zoom

Container AR 1.7229 is *narrower* than 16:9, so the video box already spans its full width
(`sW = 0.9998`). There is no horizontal room; any zoom would crop the sides. The two-axis clamp
returns 1.0 and the bars stay.

This is correct behaviour, not a failure. The bars in that mode cannot be removed by scaling at
all - the only fix would be widening the player container itself, which is a page-layout change
rather than a transform. Out of scope for now; worth revisiting.
