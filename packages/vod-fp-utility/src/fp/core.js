const curry = fn => {
  const len = fn.length;
  return function _curry(...args) {
    if (args.length < len) {
      return _curry.bind(null, ...args);
    }
    return fn.apply(null, args);
  };
};

const compose = (...fns) => {
  const fnReversed = fns.reverse();
  const filterd = fnReversed.filter(fn => typeof fn !== 'function');
  if (filterd.length) {
    console.error(filterd.join(',') + ' not function ');
    return;
  }
  return args => {
    return fnReversed.reduce((ret, fn) => fn(ret), args);
  };
};

const map = curry((fn, mappable) => mappable.map(fn));
const forEach = curry((fn, list) => list.forEach(fn));
const filter = curry((fn, list) => list.filter(fn));
const reduce = curry((fn, init, arr) => arr.reduce(fn, init));
const split = curry((a, b) => b.split(a));
const splitOnce = curry((a, b) => {
  let i = b.indexOf(a);
  if (i === -1) {
    return [b];
  }
  return [b.slice(0, i), b.slice(i + 1)];
});

const head = a => a[0];
const tail = a => a.slice(1);
const identity = a => a;

const splitMap = curry((fn1, fn2, list) => {
  const [head, ...tail] = list;
  return [fn1(head)].concat(map(fn2, tail));
});

const ifElse = curry((condition, fn1, fn2, arg) => {
  if (condition(arg)) {
    return fn1(arg);
  }
  return fn2(arg);
});

const prop = curry((a, b) => b[a]);
const join = curry(a => a.join());
const chain = curry((f, m) => m.map(f).join());

const liftA2 = curry((g, a, b) => a.map(g).ap(b));


const trace = a => {
  console.log(a);
  return a;
};

export {
  curry,
  compose,
  map,
  forEach,
  filter,
  reduce,
  head,
  tail,
  identity,
  split,
  splitOnce,
  splitMap,
  join,
  chain,
  liftA2,
  prop,
  ifElse,
  trace
};
