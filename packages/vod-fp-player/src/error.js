export const SUPPORT_ERROR = {
  NOT_SUPPORT_MSE: {
    type: 'NOT_SUPPORT_MSE'
  }
};

export const XHR_ERROR = {
  type: 'XHR_ERROR',
  ABORT: {
    type: 'XHR_ERROR',
    detail: 'ABORT',
    message: 'abort'
  },
  LOAD_ERROR: {
    type: 'XHR_ERROR',
    detail: 'LOAD_ERROR'
  },
  LOAD_TIMEOUT: {
    type: 'XHR_ERROR',
    detail: 'TIMEOUT',
    message: 'timeout'
  }
};

export const M3U8_PARSE_ERROR = {
  type: 'M3U8_PARSE_ERROR',
  INVALID: {
    type: 'M3U8_PARSE_ERROR',
    detail: 'INVALID'
  },
  PARSE_ERROR: {
    type: 'M3U8_PARSE_ERROR',
    detail: 'PARSE_ERROR'
  }
};

export const PLAYLIST_ERROR = {
  type: 'PLAYLIST_ERROR',
  MANIFEST: {
    LOAD_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'MANIFEST_LOAD_ERROR',
      fatal: true
    },
    LOAD_TIMEOUT: {
      type: 'PLAYLIST_ERROR',
      detail: 'MANIFEST_LOAD_TIMEOUT',
      fatal: true
    },
    M3U8_PARSE_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'MANIFEST_PARSE_ERROR',
      fatal: true
    }
  },
  LEVEL: {
    LOAD_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'LEVEL_LOAD_ERROR'
    },
    LOAD_TIMEOUT: {
      type: 'PLAYLIST_ERROR',
      detail: 'LEVEL_LOAD_TIMEOUT'
    },
    M3U8_PARSE_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'LEVEL_PARSE_ERROR',
      fatal: true
    }
  },
  MEDIA: {
    LOAD_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'MEDIA_LOAD_ERROR'
    },
    LOAD_TIMEOUT: {
      type: 'PLAYLIST_ERROR',
      detail: 'MEDIA_LOAD_TIMEOUT'
    },
    M3U8_PARSE_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'MEDIA_PARSE_ERROR',
      fatal: true
    }
  }
};

export const SEGMENT_ERROR = {
  LOAD_ERROR: {
    type: 'SEGMENT_ERROR',
    detail: 'SEGMENT_LOAD_ERROR'
  },
  LOAD_TIMEOUT: {
    type: 'SEGMENT_ERROR',
    detail: 'SEGMENT_LOAD_TIMEOUT'
  },
  SGEMENT_PARSE_ERROR: {
    type: 'SEGMENT_PARSE_ERROR',
    detail: 'SEGMENT_PARSE_ERROR'
  }
};

export const MEDIA_ERROR = {};
