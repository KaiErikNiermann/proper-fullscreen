# Methodology: removing baked-in letterbox

Measured 2026-08-30 on Firefox / Linux, 3440x1440 monitor (AR 2.3886), `devicePixelRatio` 1.1538.

## The problem

A 2.39:1 film uploaded/encoded inside a 16:9 container has its letterbox bars **baked into the
pixel data**. No layout change can remove them, because to the browser the frame *is* 16:9. The
only fix is to scale the whole decoded frame until the picture area fills the viewport height,
pushing the black rows off-screen.

## Proving the bars are baked in (works even under DRM)

Do not try to read pixels first. Measure geometry instead:

1. Read `video.videoWidth / video.videoHeight` -> the AR of the frame actually handed to the browser.
2. Read the element box (`offsetWidth/offsetHeight`) and `getComputedStyle(v).objectFit`.
3. Compute the letterbox the *layout* contributes under `contain`.

If the layout contributes **zero** vertical black but the user sees top/bottom bars, the bars are
necessarily encoded rows. This is a proof, not an inference, and needs no pixel access.

> Gotcha: `getBoundingClientRect()` includes transforms. Once you apply `transform: scale()` it
> reports the *post*-transform box. Use `offsetWidth`/`offsetHeight` for the layout box.

## The fix

The naive factor is `PICTURE_AR / frameAR`, but that is only an upper bound. It must be clamped
by the container width, or the picture overflows the `overflow: hidden` ancestor and is silently
cropped (measured on YouTube default mode: 311px lost per side, 25.6% of image width).

```js
const sH = containerH * PICTURE_AR / boxW;   // scale where picture fills container height
const sW = containerW / boxW;                // scale where picture hits container width
const scale = Math.max(1, Math.min(sH, sW)); // never shrink, never overflow
```

- `container` = the `overflow: hidden` ancestor that clips (`#movie_player`, `.btm-media-client`).
- `boxW` = `video.offsetWidth`, the **untransformed** layout width.
- When `sW` binds, the container is too narrow to grow into and we stop early - in an exactly-16:9
  container this yields `scale = 1`, i.e. correctly refusing to zoom at all.

Applied as `transform: scale(s)` on the `<video>`. Correct in every windowed / theater / fullscreen
state, unlike `object-fit: cover`, which fills the *box* and so over-crops whenever box AR != film AR.

**Recompute on every layout change.** A static value is wrong the moment the user changes mode.
Hook a `ResizeObserver` on the clipping container plus a `fullscreenchange` listener with a ~350ms
settle delay (fullscreen briefly reports a transitional box before the window finishes expanding).

## Three implementation rules that make it stick

1. **Use `transform: scale()`, not `object-fit: cover`.** `cover` assumes box AR == film AR.
   True only in exact fullscreen on a matched monitor; wrong in every windowed/theater state.
2. **Inject a `<style>` rule with `!important`; never set inline `style`.** Both players own the
   video's inline style attribute and rewrite it (Disney+ writes `width/height`, YouTube writes
   `width/height/left/top` in px on every resize and mode change). A stylesheet rule in `<head>`
   is outside their diff and survives.
3. **Do not add a clipping wrapper.** Both players already have an `overflow: hidden` ancestor
   that clips the scaled frame for free. Injecting a wrapper div breaks their layout and their
   fullscreen element.

Keep the factor in a CSS custom property (`--pf-scale`) so it can be retuned with one
`setProperty` call instead of re-injecting the stylesheet.

## Determining PICTURE_AR

- **No DRM (YouTube):** auto-detect from the pixels. See `youtube.md`.
- **DRM (Disney+, Netflix, Prime):** canvas readback is silently zeroed - `drawImage` +
  `getImageData` returns an all-black surface and **throws no exception**. Detection is impossible;
  the UI must offer presets plus manual entry.

Detection should always **snap to the nearest known preset**, never use the raw measurement.
