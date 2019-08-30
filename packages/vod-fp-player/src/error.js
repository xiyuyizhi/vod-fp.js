export const SUPPORT_ERROR = {
  NOT_SUPPORT_MSE: {
    type: 'SUPPORT_ERROR',
    detail: 'NOT_SUPPORT_MSE',
    fatal: true
  },
  NOT_SUPPORT_WEBSOCKET: {
    type: 'SUPPORT_ERROR',
    detail: 'NOT_SUPPORT_WEBSOCKET',
    fatal: true
  },
  NOT_SUPPORT_FETCH: {
    type: 'SUPPORT_ERROR',
    detail: 'NOT_SUPPORT_FETCH',
    fatal: true
  }
};

export const LOADER_ERROR = {
  type: 'LOADER_ERROR',
  ABORT: {
    type: 'LOADER_ERROR',
    detail: 'ABORT',
    message: 'abort'
  },
  LOAD_ERROR: {
    type: 'LOADER_ERROR',
    detail: 'LOAD_ERROR'
  },
  LOAD_TIMEOUT: {
    type: 'LOADER_ERROR',
    detail: 'LOAD_TIMEOUT',
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
  },
  KEY: {
    LOAD_ERROR: {
      type: 'PLAYLIST_ERROR',
      detail: 'kEY_LOAD_ERROR'
    },
    LOAD_TIMEOUT: {
      type: 'PLAYLIST_ERROR',
      detail: 'KEY_LOAD_TIMEOUT'
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
    type: 'SEGMENT_ERROR',
    detail: 'SEGMENT_PARSE_ERROR'
  }
};

export const MEDIA_ERROR = {
  ADD_SOURCEBUFFER_ERROR: {
    type: 'MEDIA_ERROR',
    detail: 'ADD_SOURCEBUFFER_ERROR',
    fatal: true
  },
  SOURCEBUFFER_ERROR: {
    type: 'MEDIA_ERROR',
    detail: 'SOURCEBUFFER_ERROR'
  }
};

export const FLV_LIVE_ERROR = {
  LOAD_ERROR: {
    type: 'FLV_LIVE_ERROR',
    detail: 'FLV_LIVE_LOAD_ERROR',
    fatal: true
  }
};
