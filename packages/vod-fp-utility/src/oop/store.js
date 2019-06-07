import { Maybe } from '../fp/Maybe';

function combineActions(...args) {
  return args.reduce((all, c) => {
    let { module, ACTION } = c;
    if (!module && !ACTION) {
      return { ...all, ...c };
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

function combineStates(...args) {
  return args.reduce(
    (all, c) => {
      let { module, state } = c;
      if (!module) {
        return { ...all, ...c };
      }
      let currentDerive = state.derive;
      module = module.toLowerCase();
      if (!state[module]) {
        throw new Error(`${module} store 中不存在state.${module}`);
      }
      let derive = {
        ...all.derive,
        ...{
          [module]: state.derive || {}
        }
      };
      return {
        ...all,
        ...{
          [module]: state[module]
        },
        derive
      };
    },
    { derive: {} }
  );
}

let storeId = 0;
function createStore(initState) {
  let state = initState;
  let events = {
    all: []
  };
  const _store = {
    id: storeId++,
    connect: fn => {
      return fn(_store);
    },
    dispatch: (path, payload) => {
      let props = path.split('.');
      let prop = props[0];
      let currentState = null;
      let currentDerive = null;
      if (props.length === 1) {
        state[prop] = payload;
      } else {
        currentState = state[prop];
        currentDerive = state.derive[prop];
        prop = props.slice(1)[0];
        if (!currentDerive[prop]) {
          currentState[prop] = payload;
        } else {
          currentDerive[prop](Maybe.of(currentState), payload);
        }
      }
      if (events[path]) {
        events[path].forEach(listener => listener(state));
      }
    },
    subscribe: (path, listener) => {
      if (typeof path === 'function') {
        listener = path;
        path = 'all';
      }
      events[path] ? events[path].push(listener) : (events[path] = [listener]);
      return {
        unsubscribe() {
          let index = events[push].indexOf(listener);
          events[path] = events[path].filter((_, i) => i !== index);
        }
      };
    },
    getState: path => {
      if (!path) return initState;
      if (typeof path !== 'string') {
        throw new Error('invalid path');
      }
      let props = path.split('.');
      let prop = props[0];
      if (props.length === 1) {
        return Maybe.of(state[prop]);
      }
      let currentState = state[prop];
      let currentDerive = state.derive[prop];
      prop = props.slice(1)[0];
      if (!currentDerive[prop]) {
        return currentState[prop];
      } else {
        return currentDerive[prop](Maybe.of(currentState));
      }
    }
  };
  return _store;
}

export { combineActions, combineStates, createStore };
