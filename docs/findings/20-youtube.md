# YouTube (no DRM) - verified working

Clip tested: *"Dune: Part Two but only when someone says Lisan Al Gaib"* (`v=JCAGE5OOz3A`),
2.39:1 film uploaded inside a 16:9 container. Firefox/Linux.

## Player structure

```
VIDEO.video-stream.html5-main-video   inline style="width:1712px; height:963px; left:635px; top:0px"
DIV.html5-video-container             overflow: visible  (height 0 - do not measure against this)
DIV#movie_player.html5-video-player   overflow: hidden   <-- clips for free
DIV#container.style-scope.ytd-player
YTD-PLAYER#ytd-player
DIV#player-container
DIV#player-full-bleed-container
```

- Stable selector: `video.html5-main-video` (also `.video-stream`).
- Video is `position: absolute` with **pixel** `width/height/left/top` written inline, recomputed on
  every resize and mode change. Never set inline style; use a stylesheet rule.
- YouTube already sets `object-fit: cover` (class `ytp-fit-cover-video`). Harmless: it sizes the
  box to the frame AR, so cover == contain.
- Mode detection: `ytd-watch-flexy[theater]` / `ytd-watch-flexy[fullscreen]` attributes.
- YouTube **pillarboxes the video inside a full-width `#movie_player`**, so horizontal growth is
  available while vertical is clipped. This is what makes the zoom work in theater/fullscreen.

## Pixel readback WORKS here

No Widevine on ordinary clips - `drawImage` + `getImageData` returns real data (`maxLuma: 238`).
So `PICTURE_AR` can be **auto-detected** rather than guessed.

### Detection result

Encoded frame **1920 x 1080** (AR 1.77778). Single-frame scan at t=1.44s:

| bars | top 138 | bottom 137 | left 0 | right 0 |
|---|---|---|---|---|

-> content 1920 x 805 = **2.3851:1**.

### Multi-frame sampling is mandatory

A dark scene reads as a false bar. Sample several timestamps and take the **minimum** bar
(= maximum content). Six samples at 10/25/40/55/70/85% of duration:

```
t=4.89  top136 bot138      t=26.92 top138 bot138
t=12.24 top138 bot137      t=34.26 top136 bot136
t=19.58 top137 bot137      t=41.60 top136 bot139
```

Consensus min 136/136 -> content 1920 x 808 = **2.3762:1**.

Detection lands slightly *under* the true 2.39 (808 rows vs 803) because dark picture rows next to
the boundary get counted as bar. That errs toward **under**-zooming (harmless slivers) rather than
cropping - the safe direction. **Snap to the nearest preset**; do not use the raw figure.

> Restore `currentTime` and the paused state after sampling. Await the `seeked` event and two
> `requestAnimationFrame`s before `drawImage`, or you capture the previous frame.

## CRITICAL: a fixed scale crops the picture in default mode

Applying a static `scale = PICTURE_AR / frameAR = 1.34438` across all three modes measured:

| mode | player box | video box | visible picture | letterbar | pillarbar |
|---|---|---|---|---|---|
| default | 1806 x 1015.8 (1.7778) | 1806 x 1016 | 2428 x 1015.9 | 0.1 | **-311** |
| theater | 2981.3 x 962.9 (3.0963) | 1712 x 963 | 2301.6 x 963 | 0 | 339.9 |
| fullscreen | 2981.3 x 1248 (2.3889) | 2219 x 1248 | 2983.2 x 1248.2 | -0.1 | -0.9 |

**Negative pillarbar = the picture overflows the container and is silently cropped by
`#movie_player`'s `overflow: hidden`.** In default mode that discards 311px per side - 25.6% of
the image width. The clipping ancestor that saves us in fullscreen destroys the image here.

## The fix: scale bound by BOTH axes, recomputed on layout change

```js
const sH = containerH * PICTURE_AR / boxW;  // scale where picture fills container height
const sW = containerW / boxW;               // scale where picture hits container width
const scale = Math.max(1, Math.min(sH, sW));
```

where `container` = `#movie_player` rect and `boxW` = `video.offsetWidth` (untransformed).

Verified against all three measured states:

| mode | sH | sW | effective | bound by | picture | overflow |
|---|---|---|---|---|---|---|
| default | 1.3443 | 1.0000 | **1.0000** | width | 1806 x 755.6 | 0 |
| theater | 1.3442 | 1.7414 | **1.3442** | height | 2301.3 x 962.9 | 0 |
| fullscreen | 1.3442 | 1.3435 | **1.3435** | width | 2981.3 x 1247.4 | 0 |

- **default**: correctly refuses to zoom. A 16:9 player box cannot show 2.39 content without either
  bars or cropping; leaving the bars is right. (Future option: shrink the player container to 2.39
  instead, which removes bars by changing page layout rather than scaling.)
- **theater**: full zoom, letterbox gone, pillars remain - the theater box is 3.096:1, wider than
  the film.
- **fullscreen**: exact fill, 0.6px residual.

Must be recomputed on every layout change - a static CSS var is wrong. Hook a `ResizeObserver` on
`#movie_player` plus a `fullscreenchange` listener (with ~350ms settle delay; fullscreen reports a
transitional 2.634:1 box before the window finishes expanding).
