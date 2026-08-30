# Netflix (DRM) - verified working

Title tested: `netflix.com/watch/80236314` (*Mission: Impossible — Fallout*), Firefox/Linux.
**Status: confirmed working by user.**

## Player structure

```
VIDEO                                   no class, no id
                                        inline style="height: 1327px; width: 100%"
                                        position:absolute; top:624px; left:1490.67px
                                        transform: matrix(1,0,0,1,-1490.67,-663.5)
DIV#80236314                            overflow: hidden   <-- tightest clipper; id is the TITLE ID
DIV                                     overflow: hidden
DIV.default-ltr-iqcdef-cache-18tyyic    overflow: hidden   (generated class — do not select)
DIV.passive.default-ltr-iqcdef-cache-fntwn3
DIV.watch-video--player-view            overflow: hidden
DIV.watch-video                         overflow: hidden
```

- Exactly **one** `<video>` on the page — no decoy, unlike Disney+ and Prime.
- The `<video>` has **no class and no id**. Scope by `.watch-video video`.
- **The tightest clipping ancestor's id is the numeric title id** (`#80236314`), so it changes per
  title and cannot be selected by name. Walk for the clipper;
  `.watch-video--player-view` is the stable fallback.
- `default-ltr-iqcdef-cache-*` are generated emotion/CSS-in-JS hashes. Never select on them.

## THE BUG: Netflix centres with a transform

```
position: absolute; top: 624px; left: 1490.67px;
transform: matrix(1, 0, 0, 1, -1490.67, -663.5);
transform-origin: 1490.67px 663.5px;
```

The translate is exactly `(-width/2, -height/2)` for the 2981.33 x 1327 box — i.e.
**`translate(-50%, -50%)`** written out in pixels. It is what centres the picture.

Setting `transform: scale(s) !important` **replaces** that translate, so the video jumps by
`(+1490.67, +663.5)` — down and to the right. This is the "video shifted into the bottom-right
corner" failure seen in other extensions.

### Fix: compose, never replace

```css
.watch-video video {
  transform: var(--pf-base, ) scale(var(--pf-scale, 1)) !important;
  transform-origin: 50% 50% !important;
}
```

with `--pf-base: translate(-50%, -50%)`. Re-emitting it as **percentages** rather than the measured
pixels means it stays correct when the box resizes.

Verified: container centre `(1490.7, 624)`, picture centre before `(1490.7, 624)`, after
`(1490.7, 624)` — **drift `{x: 0, y: 0}`**. Resulting computed transform
`matrix(1.26375, 0, 0, 1.26375, -1490.67, -663.5)`: our scale, Netflix's translate intact.

The engine does this generically (`readNativeTransform` + `geometry.classifyTransform`): it reads
the player's transform with our own stylesheet momentarily disabled, and only composes when the
native transform is a pure translation. Anything containing a scale or rotation is **refused** —
better to leave bars than to break the layout.

## Netflix already over-sizes the video box

| | value |
|---|---|
| Encoded frame | **1280 x 720 = exactly 16:9** (letterbox baked in) |
| Container (fullscreen) | 2981.3 x 1248, AR 2.3889 |
| Video box | 2981 x **1327**, AR 2.2464 |

The video element is **79px taller than its container** and is clipped — Netflix is already doing
a partial zoom-to-fill of its own. The solver handles this because it fits the frame into the
*box* but clamps against the *container*; the two are not the same element here, unlike YouTube.

Consequently the needed scale is **1.26375**, not the ~1.344 the other sites need — Netflix has
already absorbed part of it.

Result: `sH 1.2643`, `sW 1.2638` -> **scale 1.26375** (width-bound), picture 2981.3 x 1247.4,
**letterbar 0.3px, pillarbar 0**.

## Per-title variation — some titles are already fine

The user observed one title with no bars and *Fallout* with bars. The discriminator is the
**encoded frame AR**, readable at any time and not blocked by DRM:

```js
document.querySelector('.watch-video video').videoWidth
  / document.querySelector('.watch-video video').videoHeight
```

- `1.7778` exactly -> padded 16:9 encode, bars are baked in, the fix applies.
- `~2.39` -> native-AR encode, there are no baked bars and nothing to remove; the player letterboxes
  it correctly on its own and `scale` stays 1.

So it is not that some titles are "broken" — Netflix ships both padded and native-AR masters, and
only the padded ones need us. The two-axis clamp already returns `scale = 1` for the native ones,
so no special-casing is required.
