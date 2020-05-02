import { Maybe } from '../fp/Maybe';

function combineActions(...actions) {
  return actions.reduce((all, action) => {
    let { module, ACTION } = action;
    if (!module && !ACTION) {
      return { ...all, ...action };
    }
    Object.keys(ACTION).forEach((action) => {
      if (action !== module) {
        ACTION[action] = `${module.toLowerCase()}.${ACTION[action]}`;
      }
    });
    return {
      ...all,
      ...{
        [module]: ACTION,
      },
    };
  }, {});
}

function combineStates(...states) {
  return states.reduce(
    (all, c) => {
      let { module, getState } = c;
      if (!module) {
        return { ...all, ...getState() };
      }
      let state = getState();
      let currentDerive = state.derive;
      module = module.toLowerCase();
      let derive = {
        ...all.derive,
        ...{
          [module]: state.derive || {},
        },
      };
      delete state.derive;
      return {
        ...all,
        ...{
          [module]: state,
        },
        derive,
      };
    },
    { derive: {} }
  );
}

let storeId = 0;
function createStore(initState, actions = {}) {
  if (!initState.derive) {
    initState.derive = {};
  }
  let state = initState;
  let events = {
    all: [],
  };
  let _store = {
    ACTION: actions,
    id: storeId++,
    events,
    _findAction(path) {
      path = path.split('.');
      if (path.length === 1) {
        path = path[0];
        return actions[path.toUpperCase()];
      }
    },
    connect: (fn) => {
      return fn(_store);
    },
    dispatch: (path, payload) => {
      if (!state || !path) return;
      let props = path.split('.');
      let [modu, prop] = props;
      let currentModule = null;
      let currentDerived = null;

      if (!prop) {
        prop = modu;
        modu = null;
        let derived = state.derive[prop];
        if (derived) {
          //只是一个更新已有的某个属性的方法
          let s = derived(Maybe.of(state), payload, _store);
          if (s) {
            state = s.join();
          }
        } else if (state[prop] !== undefined) {
          state[prop] = payload;
        }
      }

      if (modu) {
        currentModule = state[modu];
        currentDerived = state.derive[modu];
        if (!currentDerived || !currentDerived[prop]) {
          if (currentModule[prop] !== undefined) {
            currentModule[prop] = payload;
          } else if (state[prop] !== undefined) {
            state[prop] = payload;
          }
        } else if (currentDerived[prop]) {
          // create the copy of currentModule //shadow copy
          const newState = currentDerived[prop](
            Maybe.of(currentModule),
            payload,
            _store
          );
          if (newState) {
            newState.map((x) => {
              state[preProp] = x;
            });
          }
        }
      }

      if (events[path]) {
        events[path].forEach((listener) => {
          listener(Maybe.of(_store.getState(path).getOrElse(payload)));
        });
      }

      // if current update a parent prop,all it's child props listener should be called
      let childs = _store._findAction(path);
      if (!childs) return;
      Object.keys(childs).forEach((child) => {
        if (child === path) return;
        child = childs[child];
        if (child !== path && events[child]) {
          events[child].forEach((listener) =>
            listener(Maybe.of(_store.getState(child).getOrElse(payload)))
          );
        }
      });
    },
    subscribe: (path, listener) => {
      if (typeof path === 'function') {
        listener = path;
        path = 'all';
      }
      events[path] ? events[path].push(listener) : (events[path] = [listener]);
      return () => {
        let index = events[path].indexOf(listener);
        events[path] = events[path].filter((_, i) => i !== index);
      };
    },
    subOnce(path, listener) {
      let _destroy;
      let _listener;
      _destroy = () => {
        let index = events[path].indexOf(_listener);
        events[path] = events[path].filter((_, i) => i !== index);
      };
      _listener = (...args) => {
        _destroy();
        listener(...args);
      };
      events[path]
        ? events[path].push(_listener)
        : (events[path] = [_listener]);
      return _destroy;
    },
    offSub(f) {
      if (f && typeof f === 'function') {
        f();
      }
    },
    getState: (path, payload) => {
      if (!state) return Maybe.of();
      if (!path) return Maybe.of(state);
      if (typeof path !== 'string') {
        throw new Error('invalid path');
      }

      let [modu, prop] = path.split('.');

      if (!prop) {
        prop = modu;
        modu = null;
        if (state[prop] !== undefined) return Maybe.of(state[prop]);
        if (state.derive[prop] !== undefined) {
          return state.derive[prop](Maybe.of(state), payload, _store);
        }
        return Maybe.of();
      }

      if (modu) {
        let currentModule = state[modu];
        let currentDerive = state.derive[prop];
        if (!currentDerive[prop]) {
          if (currentModule[prop] !== undefined) {
            return Maybe.of(currentModule[prop], payload);
          }
          return Maybe.of(state[prop]);
        }
        return currentDerive[prop](Maybe.of(currentModule), payload, _store);
      }
    },
    getConfig: (path) => {
      if (!state) return;
      if (!state.config) {
        throw new Error('config not exist in state');
      }
      if (!path) return state.config;
      let props = path.split('.');
      let prop = props[1];
      return state.config && state.config[prop];
    },
    destroy() {
      events = {
        all: [],
      };
      state = null;
    },
  };
  return _store;
}

export { combineActions, combineStates, createStore };
