import { Maybe } from '../fp/Maybe';

function combineActions(...actions) {
  return actions.reduce((all, action) => {
    let { module, ACTION } = action;
    if (!module && !ACTION) {
      return { ...all, ...action };
    }
    Object.keys(ACTION).forEach(action => {
      if (action !== module) {
        ACTION[action] = `${module.toLowerCase()}.${ACTION[action]}`;
      }
    });
    return {
      ...all,
      ...{
        [module]: ACTION
      }
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
          [module]: state.derive || {}
        }
      };
      delete state.derive;
      return {
        ...all,
        ...{
          [module]: state
        },
        derive
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
    all: []
  };
  const _store = {
    ACTION: actions,
    id: storeId++,
    _findAction(path) {
      path = path.split('.');
      if (path.length === 1) {
        path = path[0];
        return actions[path.toUpperCase()];
      }
    },
    connect: fn => {
      return fn(_store);
    },
    dispatch: (path, payload) => {
      if (!state || !path) return;
      let props = path.split('.');
      let prop = props[0];
      let currentState = null;
      let currentDerive = null;
      if (props.length === 1) {
        let deriveProp = state.derive[prop];
        if (deriveProp) {
          //只是一个更新已有的某个属性的方法
          let s = deriveProp(Maybe.of(state), payload, _store);
          if (s) {
            state = s.join();
          }
        } else if (state[prop] !== undefined) {
          state = {
            ...state,
            ...{
              [prop]: payload
            }
          };
        }
      } else {
        let parentProp = prop;
        currentState = state[prop];
        currentDerive = state.derive[prop];
        prop = props.slice(1)[0];
        if (!currentDerive || !currentDerive[prop]) {
          if (currentState[prop] !== undefined) {
            currentState[prop] = payload;
          } else if (state[prop] !== undefined) {
            state[prop] = payload;
          } else if (state[parentProp] !== undefined) {
            state[parentProp] = prop;
          }
        } else if (currentDerive[prop]) {
          // create the copy of currentState //shadow cpoy
          const newState = currentDerive[prop](
            Maybe.of({ ...currentState }),
            payload,
            _store
          );
          if (newState) {
            state[parentProp] = {
              ...currentState,
              ...newState.join()
            };
          }
        }
      }
      if (events[path]) {
        events[path].forEach(listener => {
          listener(Maybe.of(_store.getState(path).getOrElse(payload)));
        });
      }
      // if current update a parent prop,all it's child props listener should be called
      let childs = _store._findAction(path);
      if (!childs) return;
      Object.keys(childs).forEach(child => {
        if (child === path) return;
        child = childs[child];
        if (child !== path && events[child]) {
          events[child].forEach(listener =>
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
      let props = path.split('.');
      let prop = props[0];
      if (props.length === 1) {
        if (state[prop]) return Maybe.of(state[prop]);
        if (state.derive[prop]) {
          return state.derive[prop](Maybe.of(state), payload, _store);
        }
        return Maybe.of();
      }
      let currentState = state[prop];
      let currentDerive = state.derive[prop];
      prop = props.slice(1)[0];
      if (!currentDerive[prop]) {
        if (currentState[prop] !== undefined) {
          return Maybe.of(currentState[prop], payload);
        } else {
          return Maybe.of(state[prop]);
        }
      } else {
        return currentDerive[prop](Maybe.of(currentState), payload, _store);
      }
    },
    getConfig: path => {
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
        all: []
      };
    }
  };
  return _store;
}

export { combineActions, combineStates, createStore };
