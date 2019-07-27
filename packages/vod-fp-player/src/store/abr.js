import { F, Maybe } from 'vod-fp-utility';

const { curry, map, prop, compose, filter, head, trace } = F;

export default {
    module: 'ABR',
    ACTION: {
        NEXT_FORCE_LEVEL: 'nextForceLevel',
        LOAD_CHECK_TASK: 'loadCheckTask',
        ESTIMATER: 'estimater',
        REMOVE_TASK: 'removeTask',
        ADD_SPEED_SAMPLE: 'addSpeedSample'
    },
    getState() {
        return {
            nextForceLevel: -1,
            loadCheckTask: null,
            estimater: null,
            derive: {
                removeTask(state) {
                    return state.map(x => {
                        if (x.loadCheckTask) {
                            x.loadCheckTask.destroy();
                        }
                        x.loadCheckTask = null;
                        return x;
                    })
                },
                addSpeedSample(state, payload, store) {
                    Maybe.of(curry((estimater, info) => {
                        estimater.sample(info.tsRequest, info.loaded)
                    }))
                        .ap(state.map(prop('estimater')))
                        .ap(store.getState(store.ACTION.LOADINFO.CURRENT_SEG_DONWLOAD_INFO))
                }
            }
        };
    }
};
