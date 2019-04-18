/**
 * https://tools.ietf.org/html/draft-pantos-http-live-streaming-23
 */
import m3u8 from './m3u8';
import masterM3u8 from './m3u8-master';

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

const map = curry((fn, list) => list.map(fn));
const forEach = curry((fn, list) => list.forEach(fn));
const filter = curry((fn, list) => list.filter(fn));
const split = curry((a, b) => b.split(a));

const splitByColon = split(':');
const splitByComma = split(',');
const splitByEq = split('=');
const splitByAcross = split('-');

const head = a => a[0];
const tail = a => a.slice(1);
const identity = a => a;

const splitMap = curry((fn1, fn2, list) => {
  const [head, ...tail] = list;
  return [fn1(head)].concat(map(fn2, tail));
});
const filterEmpty = filter(a => Boolean(a));
const findIndex = curry((fn, list) => {
  let index = 0;
  for (let i = 0; i < list.length; i++) {
    if (fn(list[i])) return i;
  }
  return -1;
});

const ifElse = curry((condition, fn1, fn2, arg) => {
  if (condition(arg)) {
    return fn1(arg);
  }
  return fn2(arg);
});

const trace = a => {
  console.log(a);
  return a;
};

/**
 * -------------
 *
 * */

const TAG_PATTERN = /EXT(?:-X-)(.+)/;
const INFO_PATTERN = /EXTINF/;
const M3U8_FLAG = /#EXTM3U/;

const Error = {
  INVALID: {
    error: 1
  },
  PARSE_ERROR: {
    error: 2
  }
};

const valid = m3u8 => m3u8.indexOf('#EXTM3U') !== -1;

const isMaster = m3u8 => m3u8.indexOf('EXT-X-STREAM-INF') !== -1
  && m3u8.indexOf('#EXT-X-ENDLIST') === -1;

const isTag = line => line.trim().indexOf('#') === 0;

const splitLines = m3u8 => m3u8
  .split(/\n/)
  .filter(x => Boolean(x))
  .filter(x => (/#/.test(x) ? /#EXT/.test(x) : true))
  .map(line => line.replace(/("|')/g, ''));

const keyFormat = key => {
  const matched = key.match(TAG_PATTERN);
  if (matched && matched.length) {
    key = matched[1];
  }
  const [head, ...rest] = splitByAcross(key);
  return (
    head.toLowerCase()
    + rest.map(item => item[0] + item.slice(1).toLowerCase()).join('')
  );
};

const combinePair = args => {
  let [key, value] = args;
  if (!value) return {};
  if (value.length === 1) {
    value = value[0];
    value = isNaN(value) ? value : Number(value);
  }
  return { [key]: value };
};

const findCodecsIndex = findIndex(item => !!item.codecs);

const adaptCodecs = attrPairs => {
  let index = findCodecsIndex(attrPairs);
  if (index === -1) return attrPairs;
  let codecsPair = attrPairs[index];
  let next = attrPairs[index + 1];
  if (next && typeof next !== 'object') {
    attrPairs.splice(index, 2, { codecs: codecsPair.codecs + ',' + next });
  }
  return attrPairs;
};

const combineObjs = list => {
  let specialAttrs = list.every(x => typeof x !== 'object');
  if (!specialAttrs) {
    return list.reduce((all, obj) => Object.assign(all, obj), {});
  }
  return list;
};

const extractAttrs = compose(
  combineObjs,
  adaptCodecs,
  map(
    compose(
      ifElse(
        x => x.length === 1,
        head,
        compose(
          combinePair,
          splitMap(keyFormat, identity)
        )
      ),
      splitByEq
    )
  ),
  filterEmpty,
  splitByComma
);

const extractTag = compose(
  combinePair,
  splitMap(keyFormat, extractAttrs),
  splitByColon,
  tail
);

let absoluteUrl = '';

const url = url => {
  if (!/(https|http)/.test(url)) {
    return { url: absoluteUrl + url };
  }
  return { url };
};

const structureM3u8 = compose(
  // trace,
  map(ifElse(isTag, extractTag, url)),
  tail,
  splitLines
);

const combineMasterM3u8 = list => {
  const result = {
    medias: [],
    levels: [],
    url: absoluteUrl
  };
  list.forEach(item => {
    if (item.streamInf) {
      result.levels.push({
        id: result.levels.length,
        ...item.streamInf
      });
      return;
    }
    if (item.media) {
      result.medias.push(item.media);
      return;
    }
    if (item.url) {
      result.levels[result.levels.length - 1].url = item.url;
      return;
    }
    Object.assign(result, item);
  });
  return result;
};

const combinePlayListM3u8 = list => {
  const level = {
    segments: [],
    url: absoluteUrl
  };
  list.forEach(item => {
    if (item.extinf) {
      let duration;
      let name;
      if (Array.isArray(item.extinf)) {
        // 存在两个属性[duration,name]
        [duration, name] = item.extinf;
      } else {
        duration = item.extinf;
      }
      let seg = {
        duration: Number(duration)
      };
      if (name) {
        seg.name = name;
      }
      level.segments.push({
        id: level.segments.length,
        ...seg
      });
      return;
    }
    if (item.url) {
      level.segments[level.segments.length - 1].url = item.url;
      return;
    }
    Object.assign(level, item);
  });
  return level;
};

const caclTotalDuration = playlist => {
  let duration = playlist.segments.reduce(
    (total, a) => (total += a.duration),
    0
  );
  playlist.duration = duration;
  return playlist;
};

const setSegmentBound = playlist => {
  playlist.segments.forEach((segment, index) => {
    if (index === 0) {
      segment.start = 0;
      segment.end = segment.start + segment.duration;
    } else {
      segment.start = playlist.segments[index - 1].end;
      segment.end = segment.start + segment.duration;
    }
  });
  return playlist;
};

const parse = (m3u8, baseUrl) => {
  if (!valid(m3u8)) return Error.INVALID;
  absoluteUrl = baseUrl;
  let list = structureM3u8(m3u8);
  if (isMaster(m3u8)) {
    return combineMasterM3u8(list);
  }
  return compose(
    setSegmentBound,
    caclTotalDuration,
    combinePlayListM3u8
  )(list);
};

console.log(parse(masterM3u8));
console.log(parse(m3u8, 'https://youku.com/'));

export default (m3u8, baseUrl) => {
  try {
    return parse(m3u8, baseUrl);
  } catch (e) {
    return {
      ...Error.PARSE_ERROR,
      msg: e.message
    };
  }
};
