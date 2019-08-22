const ACTION = {
  MAX_BUFFER_LENGTH: 'maxBufferLength',
  MAX_FLY_BUFFER_LENGTH: 'maxFlyBufferLength',
  TICK_INTERVAL: 'tickInterval',
  MAX_FRAG_LOOKUP_TOLERANCE: 'maxFragLookUpTolerance',
  MAX_BUFFER_GAP_TOLERANCE: 'maxBufferGapTolerance',
  END_STREAM_TOLERANCE: 'endStreamTolerance',
  MANUAL_SEEK: 'manualSeek',
  SEGMENT_MAX_TIMEOUT: 'segmentMaxTimeout',
  MAX_LEVEL_RETRY_COUNT: 'maxLevelRetryCount',
  REQUEST_RETRY_COUNT: 'requestRetryCount',
  REQUEST_RETRY_DELAY: 'requestRetryDelay',
  WORKER_ENABLE: 'workerEnable',
  ABR_ENABLE: 'abrEnable',
  ABR_EWMA_FAST_VOD: 'abrEwmaFastVoD',
  ABR_EWMA_SLOW_VOD: 'abrEwmaSlowVoD',
  ABR_EWMA_DEFAULT_ESTIMATE: 'abrEwmaDefaultEstimate',
  LIVE_FLUSH_INTERVAL_FACTOR: 'liveFlushIntervalFactor',
  LIVE_LATENCY_FACTOR: 'liveLatencyFactor'
};

const state = {
  maxBufferLength: 60,
  maxFlyBufferLength: 160,
  tickInterval: 200,
  segmentMaxTimeout: 20 * 1000,
  manualSeek: 0.16,
  maxFragLookUpTolerance: 0.2,
  maxBufferGapTolerance: 0.4,
  endStreamTolerance: 0.2,
  maxLevelRetryCount: 2,
  requestRetryCount: 2,
  requestRetryDelay: 1000,
  workerEnable: true,
  // abr about
  abrEnable: true,
  abrEwmaFastVoD: 3,
  abrEwmaSlowVoD: 10,
  abrEwmaDefaultEstimate: 5e5, // 500 kbps
  //live about
  liveFlushIntervalFactor: 0.7,
  liveLatencyFactor: 0.9
};

export default {
  module : 'CONFIG',
  ACTION,
  getState() {
    return state;
  }
};
