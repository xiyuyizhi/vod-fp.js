import {
  combineActions,
  combineStates,
  createStore
} from '../../src/oop/store';
import { Just } from '../../src';
import { F } from '../../src';
import { create } from 'domain';

const { compose, map, prop } = F;
const chai = require('chai');
const spies = require('chai-spies');
chai.use(spies);
chai.should();

describe.only('OOp: test store', function() {
  let spy;

  beforeEach(() => {
    spy = chai.spy();
  });

  it('combineActions', () => {
    const actions1 = {
      TO_DO1: 'toDo1',
      TO_DO2: 'toDo2'
    };
    const actions2 = {
      TO_DO3: 'toDo3',
      TO_DO4: 'toDo4'
    };

    const combined = combineActions(actions1, actions2);
    Object.keys(combined).length.should.be.equal(4);
  });

  it('combineActions with module', () => {
    const global = {
      ERROR: 'error'
    };
    const module1 = {
      module: 'PLAYLIST',
      ACTION: {
        M3U8_URL: 'm3u8Url',
        PLAYLIST: 'playlist',
        CURRENT_LEVEL: 'currentLevel'
      }
    };
    const module2 = {
      module: 'MEDIA',
      ACTION: {
        MEDIA_SOURCE: 'mediaSource'
      }
    };
    const result = combineActions(global, module1, module2);
    result.should.have.property('ERROR');
    result.should.have.property('PLAYLIST');
    result.should.have.property('MEDIA');
    result['ERROR'].should.be.equal('error');
    result['PLAYLIST'].should.have.property('PLAYLIST');
    result['PLAYLIST'].should.have.property('CURRENT_LEVEL');
    result['PLAYLIST']['CURRENT_LEVEL'].should.be.equal(
      'playlist.currentLevel'
    );
  });

  it('combineStates', () => {
    const state1 = {
      playlist: {
        levels: []
      }
    };
    const state2 = {
      media: {
        mediaEle: null,
        mediaSource: null
      }
    };
    const result = combineStates(state1, state2);
    result.should.have.property('derive');
    Object.keys(result).length.should.be.equal(3);
  });

  it('combineStates with module', () => {
    const module1 = {
      module: 'PLAYLIST',
      state: {
        m3u8Url: '',
        playlist: {
          levels: [],
          currentLevel: -1
        },
        derive: {
          currentLevel: () => {}
        }
      }
    };

    const module2 = {
      module: 'MEDIA',
      state: {
        media: {
          mediaEle: null,
          mediaSource: null
        }
      }
    };
    const result = combineStates(module1, module2);
    result.should.have.property('derive');
    result.should.have.property('m3u8Url');
    result.should.have.property('playlist');
    result.should.have.property('media');
  });

  it('createStore', () => {
    const states = {
      m3u8Url: '',
      playlist: {
        levels: [],
        currentLevel: -1
      }
    };
    const actions = {
      M3U8_URL: 'm3u8Url',
      PLAYLIST: 'playlist',
      CURRENT_LEVEL: 'playlist.currentLevel'
    };

    const store = createStore(states, actions);
    const initState = store.getState();
    initState.constructor.should.be.equal(Just);
    initState.value().should.have.property('m3u8Url');
    initState.value().should.have.property('playlist');

    store.subscribe(actions.M3U8_URL, spy);
    store.dispatch(actions.M3U8_URL, 'https://xxxx.com');
    spy.should.be.called();
    store
      .getState()
      .value()
      .m3u8Url.should.be.equal('https://xxxx.com');

    store.dispatch(actions.PLAYLIST, {
      levels: [123],
      currentLevel: 1
    });
    store
      .getState()
      .value()
      .playlist.levels[0].should.be.equal(123);
    store.dispatch(actions.CURRENT_LEVEL, 2);
  });

  it('createStore with module', () => {
    const module1 = {
      module: 'PLAYLIST',
      state: {
        playlist: {
          levels: [],
          currentLevel: -1
        },
        derive: {
          levels(state, payload) {
            if (!payload) {
              return map(prop('levels'))(state);
            }
            return state.map(x => {
              x.levels = payload;
              return x;
            });
          },
          currentLevel(state, payload) {
            if (!payload) {
              return map(prop('currentLevel'))(state);
            }
            return state.map(x => {
              x.currentLevel = payload;
              return x;
            });
          }
        }
      },
      ACTION: {
        PLAYLIST: 'playlist',
        CURRENT_LEVEL: 'currentLevel',
        LEVELS: 'levels'
      }
    };
    const a = combineActions(module1);
    const s = combineStates(module1);
    const store = createStore(s, a);

    store
      .getState(a.PLAYLIST.LEVELS)
      .value()
      .length.should.be.equal(0);
    store.subscribe(a.PLAYLIST.LEVELS, v => {
      v.value()[0].should.be.equal(123);
    });
    store.dispatch(a.PLAYLIST.LEVELS, [123]);

    store
      .getState(a.PLAYLIST.CURRENT_LEVEL)
      .value()
      .should.be.equal(-1);
    store.dispatch(a.PLAYLIST.CURRENT_LEVEL, 1);
    store
      .getState(a.PLAYLIST.CURRENT_LEVEL)
      .value()
      .should.be.equal(1);
  });
});
