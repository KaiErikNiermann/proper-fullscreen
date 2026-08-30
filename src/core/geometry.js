/*
 * The scaling maths. Pure functions, no DOM — this is the piece that must not be duplicated
 * per-adapter, and the piece worth testing in isolation.
 */
(function (PF) {
  'use strict';

  /**
   * @typedef {Object} Layout
   * @property {number} containerW  width of the `overflow:hidden` ancestor that clips
   * @property {number} containerH  height of that ancestor
   * @property {number} boxW        UNTRANSFORMED video layout width (offsetWidth)
   * @property {number} boxH        UNTRANSFORMED video layout height (offsetHeight)
   * @property {number} frameAR     videoWidth / videoHeight — the AR actually decoded
   * @property {number} pictureAR   AR of the real image inside that frame
   */

  /**
   * @typedef {Object} Solution
   * @property {number} scale       factor to apply as transform: scale()
   * @property {number} scaleH      factor at which the picture fills container height
   * @property {number} scaleW      factor at which the picture hits container width
   * @property {'height'|'width'|'none'} boundBy
   * @property {number} pictureW    visible picture width after scaling
   * @property {number} pictureH    visible picture height after scaling
   * @property {number} letterbar   black px above/below the picture, per side
   * @property {number} pillarbar   black px left/right of the picture, per side
   */

  /**
   * Solve for the largest scale that removes baked-in bars without overflowing the clipping
   * container. Clamping by BOTH axes is essential: bounding by height alone crops the sides
   * (measured on YouTube default mode: 311px lost per side, 25.6% of image width).
   *
   * The frame is first fitted into the box under `object-fit: contain`, giving $fit_w \times
   * fit_h$. The picture inside that frame spans the full width when it is wider than the frame
   * (letterboxed) and the full height otherwise (pillarboxed). The answer is then
   * $s = \max(1, \min(container_h / pict_h,\; container_w / pict_w))$.
   *
   * @param {Layout} layout
   * @returns {Solution}
   */
  function solve(layout) {
    const { containerW, containerH, boxW, boxH, frameAR, pictureAR } = layout;

    const fitH = Math.min(boxH, boxW / frameAR);
    const fitW = fitH * frameAR;

    // picture inside the decoded frame, before scaling
    const letterboxed = pictureAR >= frameAR;
    const pw0 = letterboxed ? fitW : fitH * pictureAR;
    const ph0 = letterboxed ? fitW / pictureAR : fitH;

    const scaleH = containerH / ph0;
    const scaleW = containerW / pw0;
    const raw = Math.min(scaleH, scaleW);
    const scale = Math.max(1, raw);

    const pictureW = pw0 * scale;
    const pictureH = ph0 * scale;

    return {
      scale,
      scaleH,
      scaleW,
      boundBy: scale === 1 ? 'none' : (scaleH <= scaleW ? 'height' : 'width'),
      pictureW,
      pictureH,
      letterbar: Math.max(0, (containerH - pictureH) / 2),
      pillarbar: Math.max(0, (containerW - pictureW) / 2),
    };
  }

  /**
   * Whether a solution is worth applying at all. Below ~0.5% the transform costs a compositor
   * layer for nothing.
   * @param {Solution} s
   */
  const isWorthApplying = (s) => s.scale > 1.005;

  PF.geometry = { solve, isWorthApplying };
})(globalThis.PF = globalThis.PF || {});
