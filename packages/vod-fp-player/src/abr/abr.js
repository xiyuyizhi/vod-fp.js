
import { F, Tick, Logger } from "vod-fp-utility"
import EwmaBandWidthEstimator from "../utils/ewma-bandwidth-estimator"
import { ACTION, LOADPROCESS } from "../store"
import { Maybe } from "vod-fp-utility/src";
import { abortLoadingSegment } from "../playlist/segment"
const { curry, prop } = F;

const logger = new Logger('player')

const BUFFER_TENSION_FACTOR = 0.2;
const LOAD_ABORT_BUFFER_REFERENCE_FACTOR = 0.2;
const LOAD_CHECK_REAL_DO_FACTOR = 0.5;
const LOAD_CONTINUE_FACTOR = 0.8;
const SPEED_USAGE_FACTOR = 0.7;
const SPEED_USAGE_SLOW_FACTOR = 0.35;
const LOW_BUFFER_FACTOR = 0.3;

function _selectForceLevel({ getState }, loadRate, maxCanLoadTime, currentLevelLoadedDelay, segment) {

    return getState(ACTION.PLAYLIST.LEVELS).map(levels => {
        let { levelId, duration } = segment;
        for (let i = levelId - 1; i > 0; i--) {
            let biterate = +levels[i].bandwidth;
            let nextLevelLoadedDelay = biterate * duration / loadRate;
            if (nextLevelLoadedDelay < maxCanLoadTime && nextLevelLoadedDelay < currentLevelLoadedDelay) {
                return i;
            }
        }
    }).getOrElse(1)

}

function _loadCheck({ getState, connect, dispatch, getConfig }, startTs, segment) {
    return () => {
        let now = performance.now();
        let { duration, levelId } = segment;
        let segLoadToLong = (now - startTs) / 1000 > duration * LOAD_CHECK_REAL_DO_FACTOR;
        if (segLoadToLong && levelId && levelId !== 1) {
            Maybe.of(curry((bufferLength, media, loadInfo) => {
                if (!loadInfo) return;
                let { loaded, total, tsRequest } = loadInfo;
                if (!total) {
                    // use bandwidth * duration to cacl total size
                    total = getState(ACTION.PLAYLIST.FIND_LEVEL, segment.levelId).map(level => {
                        return level.bandwidth * segment.duration
                    }).join()
                }
                let loadSpeed = loaded / tsRequest * 1000 // Bps
                let fetchFinishDelay = (total - loaded) / loadSpeed // s
                let bufferStarvationDelay = bufferLength / (media.playbackRate || 1);
                logger.log(`load process: ${(loaded / total * 100).toFixed(2)}%`)
                if (fetchFinishDelay / bufferStarvationDelay > LOAD_ABORT_BUFFER_REFERENCE_FACTOR) {
                    logger.warn(`current segment load complete still need: ${fetchFinishDelay} s, \n rest buffer can play time: ${bufferStarvationDelay}, \n download speed: ${loadSpeed * 8} bps`);
                    let bufferTension = bufferStarvationDelay / getConfig(ACTION.CONFIG.MAX_BUFFER_LENGTH) < BUFFER_TENSION_FACTOR;
                    if (loaded / total > LOAD_CONTINUE_FACTOR && !bufferTension) {
                        logger.log('the segment will load complete,continue...');
                        return;
                    }
                    let forcedLevel = connect(_selectForceLevel)(loadSpeed * 8 * SPEED_USAGE_FACTOR, bufferStarvationDelay, fetchFinishDelay, segment)
                    logger.log('forced level', forcedLevel)
                    dispatch(ACTION.ABR.NEXT_FORCE_LEVEL, forcedLevel)
                    // abort current segment
                    connect(abortLoadingSegment);
                }
            }))
                .ap(getState(ACTION.BUFFER.GET_BUFFER_INFO).map(prop('bufferLength')))
                .ap(getState(ACTION.MEDIA.MEDIA_ELE))
                .ap(getState(ACTION.LOADINFO.CURRENT_SEG_DONWLOAD_INFO))
        }
    }
}


function _getNextAutoLevel({ getState, connect, getConfig }) {

    return Maybe.of(curry((estimator, bufferInfo, media, levels, segDuration, currentLevelId) => {
        if (!estimator.canEstimate()) return;
        let maxBufferLength = getConfig(ACTION.CONFIG.MAX_BUFFER_LENGTH)
        let bufferStarvationDelay = bufferInfo.bufferLength / media.playbackRate;
        let avgbw = estimator.getEstimate();
        let ajustedBw;
        let maxLevel = levels.length - 1;
        let minLevel = 1;
        for (let i = maxLevel; i >= minLevel; i--) {
            if (bufferStarvationDelay / maxBufferLength > LOW_BUFFER_FACTOR || i < currentLevelId) {
                ajustedBw = avgbw * SPEED_USAGE_FACTOR
            } else {
                // buffer in a low water level or the level > current use level
                ajustedBw = avgbw * SPEED_USAGE_SLOW_FACTOR;
            }
            let biterate = +levels[i].bandwidth;
            if (biterate < ajustedBw &&
                (bufferStarvationDelay === 0 || (biterate * segDuration / ajustedBw) < bufferStarvationDelay)
            ) {
                return i;
            }
        }
        return 1;
    }))
        .ap(getState(ACTION.ABR.ESTIMATER))
        .ap(getState(ACTION.BUFFER.GET_BUFFER_INFO))
        .ap(getState(ACTION.MEDIA.MEDIA_ELE))
        .ap(getState(ACTION.PLAYLIST.LEVELS))
        .ap(getState(ACTION.PLAYLIST.AVG_SEG_DURATION))
        .ap(getState(ACTION.PLAYLIST.CURRENT_LEVEL_ID))
        .getOrElse(1)
}


function abrProcess({ subOnce, dispatch, connect }, segment) {
    let loadCheckTask;
    subOnce(LOADPROCESS.SEGMENT_LOADING, () => {
        let ts = performance.now();
        let loadCheck = connect(_loadCheck)(ts, segment)
        loadCheckTask = Tick
            .of()
            .addTask(loadCheck)
            .interval(100)
            .immediateRun()
        dispatch(ACTION.ABR.LOAD_CHECK_TASK, loadCheckTask)
    })

    subOnce(LOADPROCESS.SEGMENT_LOADED, () => {
        dispatch(ACTION.ABR.NEXT_FORCE_LEVEL, -1);
        dispatch(ACTION.ABR.REMOVE_TASK)
        dispatch(ACTION.ABR.ADD_SPEED_SAMPLE)
    })

}

function abrBootstrap({ subscribe, dispatch, getConfig }) {
    // init estimator
    let bwEstimator = new EwmaBandWidthEstimator(
        getConfig(ACTION.CONFIG.ABR_EWMA_SLOW_VOD),
        getConfig(ACTION.CONFIG.ABR_EWMA_FAST_VOD),
        getConfig(ACTION.CONFIG.ABR_EWMA_DEFAULT_ESTIMATE),
    );
    dispatch(ACTION.ABR.ESTIMATER, bwEstimator)
    // listen segement abort 、error event
    subscribe(LOADPROCESS.SEGMENT_LOAD_ABORT, () => {
        dispatch(ACTION.ABR.REMOVE_TASK)
        dispatch(ACTION.ABR.ADD_SPEED_SAMPLE)
    })
    subscribe(LOADPROCESS.SEGMENT_LOAD_ERROR, () => {
        dispatch(ACTION.ABR.REMOVE_TASK)
        dispatch(ACTION.ABR.ADD_SPEED_SAMPLE)
    })
}

function getNextABRLoadLevel({ getState, dispatch, connect }) {
    return getState(ACTION.ABR.NEXT_FORCE_LEVEL).map(x => {
        if (x !== -1) {
            dispatch(ACTION.ABR.NEXT_FORCE_LEVEL, -1);
            return x;
        }
        return connect(_getNextAutoLevel)
    })
}

_selectForceLevel = curry(_selectForceLevel)
_loadCheck = curry(_loadCheck)
_getNextAutoLevel = curry(_getNextAutoLevel)
abrProcess = curry(abrProcess)
abrBootstrap = curry(abrBootstrap)
getNextABRLoadLevel = curry(getNextABRLoadLevel)

export {
    abrProcess,
    abrBootstrap,
    getNextABRLoadLevel
}


