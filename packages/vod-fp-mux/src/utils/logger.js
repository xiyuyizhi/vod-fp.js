const logger = {
    log: (...rest) => {
        console.log(...rest);
    },
    warn: (...rest) => {
        console.warn(...rest);
    },
    error: (...rest) => {
        console.error(...rest)
    }
};

export { logger }