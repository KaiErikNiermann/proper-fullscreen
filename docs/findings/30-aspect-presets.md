# Aspect ratio presets

Under DRM the picture AR **cannot** be detected, so it must be declared. Even where detection works
the raw figure should snap to the nearest preset. This is the list the UI offers.

| Preset | AR | Notes |
|---|---|---|
| Univisium / 2:1 | 2.000 | Netflix originals, a lot of modern streaming drama |
| Scope / "widescreen" | **2.39** | Standard anamorphic cinema. The common case. Older prints are 2.35 |
| Scope (older) | 2.35 | Pre-1970 anamorphic; within ~1% of 2.39 |
| Ultra Panavision / Ben-Hur | 2.76 | Rare - *Hateful Eight*, *Ben-Hur* |
| Flat / 1.85 | 1.85 | Standard non-anamorphic theatrical |
| IMAX Digital | 1.90 | *Endgame*, most Marvel IMAX-mastered titles |
| IMAX 70mm / 1.43 | 1.43 | **Taller** than 16:9 - pillarbox, not letterbox |
| 16:9 | 1.7778 | No-op; the container AR itself |
| Academy / 4:3 | 1.3333 | Pre-1953, and deliberate throwbacks (*The Grand Budapest Hotel* uses 3 ARs) |
| Custom | user-entered | Free numeric entry |

## Notes for the UI

- **2.39 is the default guess** for anything letterboxed inside 16:9.
- 2.35 vs 2.39 differ by <1%; on a 1440px-tall panel that is ~23px of image. Offer both but do not
  agonise - a user who cannot tell should pick 2.39.
- **1.43 and 1.33 are narrower than 16:9**, so the bars are on the *left and right*. The same
  two-axis clamp handles this (`sW` binds immediately, scale stays 1) but a genuine fix means
  scaling to fill *width*, cropping top/bottom - a different branch, currently out of scope.
- Titles can change AR mid-film (IMAX sequences in Nolan/Marvel films switch between 2.39 and
  1.90). A static per-site setting will be wrong for parts of those. Per-title override + a quick
  toggle is the mitigation.
- Where detection is possible (YouTube), run it and **preselect** the nearest preset rather than
  applying the raw number.
