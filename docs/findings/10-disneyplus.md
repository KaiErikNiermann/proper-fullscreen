# Disney+ (DRM) - verified working

Title tested: *Avengers: Age of Ultron*, `disneyplus.com/en-gb/play/...`, Firefox/Linux.
**Status: confirmed working by user.**

## Player structure

```
VIDEO#hivePlayer1.btm-media-client-element     inline style="width:100%; height:100%"
DIV#media-element-container-<uuid>             overflow: visible
DIV#bamtech-media-player--<ts>.btm-media-client   overflow: hidden   <-- clips for free
DISNEY-WEB-PLAYER#player-<uuid>
DIV.btm-media-clients
DIV.btm-media-player.playback-experience-v2
```

- Stable selector: `video.btm-media-client-element` (the `#hivePlayer1` id is generated).
- There are **two** `<video>` elements; the first is `display:none`. Select the one with
  `videoWidth > 0`, not `querySelector('video')`.
- `object-fit: contain`.
- `.btm-media-client` carries `--active-aspect-ratio-width/height` CSS vars (both `0px` here).

## Measurements

| | value |
|---|---|
| Encoded frame | **853 x 480** -> AR **1.77708 = exactly 16:9** |
| Video element box (windowed) | 2981.33 x 1131.87 CSS = 3440 x 1306 device |
| Layout letterbox contribution | **0 px** |
| Layout pillarbox contribution | 559.6 device px per side |
| Stream | `H264_1_CMAF_CENC_CTR_1764K` |

Zero layout letterbox + visible top/bottom bars => **bars are baked into the 480 encoded rows.**

## DRM behaviour

`drawImage(video)` then `getImageData` returns an **all-black surface and throws nothing**. Do not
treat "no exception" as "readback succeeded" - test for actual luma:

```js
let maxLuma = 0;
for (let i = 0; i < d.length; i += 4*97) maxLuma = Math.max(maxLuma, d[i], d[i+1], d[i+2]);
const readable = maxLuma > 16;   // false under Widevine
```

`browser.tabs.captureVisibleTab` also fails on the DRM surface - it killed the extension's
WebSocket connection twice. Avoid screenshotting a protected tab.

## Applied fix

`PICTURE_AR = 2.39`, `frameAR = 1.77708` -> **scale = 1.3449**.

```js
const s = document.createElement('style');
s.id = 'pf-zoom';
s.textContent = `
  video.btm-media-client-element {
    transform: scale(var(--pf-scale, 1)) !important;
    transform-origin: 50% 50% !important;
  }`;
document.head.appendChild(s);
document.documentElement.style.setProperty('--pf-scale', scale.toFixed(5));
```

### Result (windowed, box 2.634:1)

| | before | after |
|---|---|---|
| Letterbox top/bottom | baked in | **0 px** |
| Pillarbox per side | 559.6 device px | 159 device px |
| Visible picture | 2320.9 x ~970 | **3121.7 x 1306.2 device px** |

Survived 2.5 s of continuous playback with the rule and computed `matrix(1.3449, ...)` intact;
the player's own inline `width:100%; height:100%` was left untouched rather than fighting it.

Residual 159px pillars are correct - the *window* is 2.634:1, wider than the film. In fullscreen
the box becomes 2.3886:1 and they collapse to ~0.

## Notes

- 480p is a Widevine L3 cap on Firefox/Linux (H.264 CENC ladder), not an ABR choice. The padding
  to 16:9 is a property of that ladder; 4K/HEVC ladders are more often encoded at native picture AR.
- `PICTURE_AR = 2.39` is an assumption here and cannot be verified under DRM. Must come from the
  preset UI.
