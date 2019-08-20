export const ERROR = {
  NOT_VALID_FORMAT: 'NOT_VALID_FORMAT',
  PARSE_ERROR: 'PARSE_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR'
}

export const withMessage = (errorType, msg) => {
  return {type: errorType, message: msg}
}