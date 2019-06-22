const ACTION = {
  MAX_BUFFER_LENGTH: 'maxBufferLength',
  MAX_FRGA_LOOKUP_TOLERANCE: 'maxFragLookUpTolerance',
  MAX_BUFFER_HOLE: 'maxBufferHole',
  MAX_TIMEOUT: 'maxTimeout',
  MAX_LEVEL_RETRY_COUNT: 'maxLevelRetryCount',
  REQUEST_RETRY_COUNT: 'requestRetryCount',
  REQUEST_RETRY_DELAY: 'requestRetryDelay'
};

const state = {
  maxBufferLength: 60,
  maxTimeout: 20 * 1000,
  maxFragLookUpTolerance: 0.25,
  maxBufferHole: 0.4,
  maxLevelRetryCount: 2,
  requestRetryCount: 2,
  requestRetryDelay: 800
};

export default { module: 'CONFIG', ACTION, state };
