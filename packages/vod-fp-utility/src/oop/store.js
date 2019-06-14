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
      let { module, state } = c;
      if (!module) {
        return { ...all, ...c };
      }
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
      let props = path.split('.');
      let prop = props[0];
      let currentState = null;
      let currentDerive = null;
      if (props.length === 1) {
        let deriveProp = state.derive[prop];
        if (deriveProp) {
          //只是一个更新已有的某个属性的方法
          state = deriveProp(Maybe.of(state), payload).join();
        } else {
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
          }
        } else if (currentDerive[prop]) {
          // create the copy of currentState //shadow cpoy
          const newState = currentDerive[prop](
            Maybe.of({ ...currentState }),
            payload
          );
          if (!newState) {
            throw new Error(`${path} not support set value`);
          }
          state[parentProp] = {
            ...currentState,
            ...newState.join()
          };
        }
      }
      if (events[path]) {
        events[path].forEach(listener => listener(_store.getState(path)));
      }
      // if current update a parent prop,all it's child props listener should be called
      let childs = _store._findAction(path);
      if (!childs) return;
      Object.keys(childs).forEach(child => {
        if (child === path) return;
        child = childs[child];
        if (child !== path && events[child]) {
          events[child].forEach(listener => listener(_store.getState(child)));
        }
      });
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
      if (!path) return Maybe.of(state);
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
        if (currentState[prop] !== undefined) {
          return Maybe.of(currentState[prop]);
        } else {
          return Maybe.of(state[prop]);
        }
      } else {
        return currentDerive[prop](Maybe.of(currentState));
      }
    }
  };
  return _store;
}

export { combineActions, combineStates, createStore };