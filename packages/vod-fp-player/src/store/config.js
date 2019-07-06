const ACTION = {
  MAX_BUFFER_LENGTH: 'maxBufferLength',
  MAX_FLY_BUFFER_LENGTH: 'maxFlyBufferLength',
  START_POSITION: 'startPosition',
  TICK_INTERVAL: 'tickInterval',
  MAX_FRAG_LOOKUP_TOLERANCE: 'maxFragLookUpTolerance',
  MAX_BUFFER_GAP_TOLERANCE: 'maxBufferGapTolerance',
  END_STREAM_TOLERANCE: 'endStreamTolerance',
  MANUAL_SEEK: 'manualSeek',
  MAX_TIMEOUT: 'maxTimeout',
  MAX_LEVEL_RETRY_COUNT: 'maxLevelRetryCount',
  REQUEST_RETRY_COUNT: 'requestRetryCount',
  REQUEST_RETRY_DELAY: 'requestRetryDelay'
};

const state = {
  maxBufferLength: 60,
  maxFlyBufferLength: 160,
  startPosition: 0,
  tickInterval: 200,
  maxTimeout: 20 * 1000,
  manualSeek: 0.08,
  maxFragLookUpTolerance: 0.2,
  maxBufferGapTolerance: 0.4,
  endStreamTolerance: 0.2,
  maxLevelRetryCount: 2,
  requestRetryCount: 2,
  requestRetryDelay: 800
};

export default {
  module: 'CONFIG',
  ACTION,
  getState() {
    return state;
  }
};
