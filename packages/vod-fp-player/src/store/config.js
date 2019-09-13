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
  // live
  ABR_EWMA_FAST_LIVE: 'abrEwmaFastLive',
  ABR_EWMA_SLOW_LIVE: 'abrEwmaSlowLive',
  LIVE_FLUSH_INTERVAL_FACTOR: 'liveFlushIntervalFactor',
  LIVE_LATENCY_FACTOR: 'liveLatencyFactor',
  FLV_LIVE: 'flvLive',
  FLV_MUX_WATER_MARK: 'flvMuxWaterMark',
  FLV_LIVE_MAX_DELAY: 'flyLiveMaxDelay'
};

const state = {
  maxBufferLength: 60,
  maxFlyBufferLength: 100,
  tickInterval: 200,
  segmentMaxTimeout: 20 * 1000,
  manualSeek: 0.16,
  maxFragLookUpTolerance: 0.2,
  maxBufferGapTolerance: 0.4,
  endStreamTolerance: 0.2,
  maxLevelRetryCount: 3,
  requestRetryCount: 3,
  requestRetryDelay: 1500,
  workerEnable: true,
  // abr about
  abrEnable: true,
  abrEwmaFastVoD: 3,
  abrEwmaSlowVoD: 9,
  abrEwmaDefaultEstimate: 5e5, // 500 kbps
  //live about
  abrEwmaFastLive: 1,
  abrEwmaSlowLive: 10,
  liveFlushIntervalFactor: 0.7,
  liveLatencyFactor: 0.9,
  flvLive: false,
  flvMuxWaterMark: 1024 * 200,
  flyLiveMaxDelay: 4
};

export default {
  module: 'CONFIG',
  ACTION,
  getState() {
    return state;
  }
};
