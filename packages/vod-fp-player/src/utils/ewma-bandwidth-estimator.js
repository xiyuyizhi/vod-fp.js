/*
 * from hls.js
 *
 * EWMA Bandwidth Estimator
 *  - heavily inspired from shaka-player
 * Tracks bandwidth samples and estimates available bandwidth.
 * Based on the minimum of two exponentially-weighted moving averages with
 * different half-lives.
 */

import EWMA from './ewma';

class EwmaBandWidthEstimator {
  constructor(slow, fast, defaultEstimate) {
    this.defaultEstimate_ = defaultEstimate;
    this.minWeight_ = 0.001;
    this.minDelayMs_ = 50;
    this.slow_ = new EWMA(slow);
    this.fast_ = new EWMA(fast);
  }

  sample(durationMs, numBytes) {
    // 字节/ms --> bit/s
    durationMs = Math.max(durationMs, this.minDelayMs_);
    let bandwidth = (8000 * numBytes) / durationMs; // -> bps
    let weight = durationMs / 1000; // 权重(s)
    this.fast_.sample(weight, bandwidth);
    this.slow_.sample(weight, bandwidth);
  }

  canEstimate() {
    let fast = this.fast_;
    return fast && fast.getTotalWeight() >= this.minWeight_;
  }

  getEstimate() {
    if (this.canEstimate()) {
      // Take the minimum of these two estimates.  This should have the effect of
      // adapting down quickly, but up more slowly.
      return Math.min(this.fast_.getEstimate(), this.slow_.getEstimate());
    } else {
      return this.defaultEstimate_;
    }
  }

  destroy() { }
}
export default EwmaBandWidthEstimator;
