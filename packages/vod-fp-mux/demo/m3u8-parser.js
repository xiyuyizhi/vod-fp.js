/**
 * https://tools.ietf.org/html/draft-pantos-http-live-streaming-23
 */

import { F } from 'vod-fp-utility';

const {
  curry,
  compose,
  map,
  forEach,
  filter,
  head,
  tail,
  identity,
  split,
  splitOnce,
  splitMap,
  ifElse,
  trace
} = F;

const TAG_PATTERN = /EXT(?:-X-)(.+)/;
const SPLIT_COMMA_PATTERN = /,(?:(?=[a-zA-Z-]+(?:=|"|$)))/;
const Error = {
  INVALID: {
    error: 1
  },
  PARSE_ERROR: {
    error: 2
  }
};
const splitOnceByColon = splitOnce(':');
const splitOnceByEq = splitOnce('=');
const splitByComma = split(SPLIT_COMMA_PATTERN);
const splitByAcross = split('-');
const filterEmpty = filter(a => Boolean(a) && a !== ',');

const valid = m3u8 => m3u8.indexOf('#EXTM3U') !== -1;

const isMaster = m3u8 =>
  m3u8.indexOf('EXT-X-STREAM-INF') !== -1 &&
  m3u8.indexOf('#EXT-X-ENDLIST') === -1;

const isTag = line => line.trim().indexOf('#EXT') === 0;

const splitLines = m3u8 =>
  m3u8
    .split(/\n/)
    .filter(x => Boolean(x))
    .filter(x => (/#/.test(x) ? /#EXT/.test(x) : true))
    .map(line => line.replace(/("|'|\s+)/g, '').trim());

const keyFormat = key => {
  const matched = key.match(TAG_PATTERN);
  if (matched && matched.length) {
    key = matched[1];
  }
  const [head, ...rest] = splitByAcross(key);
  return (
    head.toLowerCase() +
    rest.map(item => item[0] + item.slice(1).toLowerCase()).join('')
  );
};

const combinePair = args => {
  let [key, value] = args;
  if (key === 'discontinuity') return { [key]: true };
  if (!value) return {};
  if (value.length === 1) {
    value = value[0];
    value = isNaN(value) ? value : Number(value);
  }
  return { [key]: value };
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
  map(
    compose(
      ifElse(
        x => x.length === 1,
        head, //eg: EXTINF:duration
        compose(
          combinePair,
          splitMap(keyFormat, identity)
        ) // eg: EXT-X-MEDIA:TYPE=AUDIO,URI="XXXX"
      ),
      splitOnceByEq
    )
  ),
  filterEmpty,
  splitByComma
);

const extractTag = compose(
  combinePair,
  splitMap(keyFormat, extractAttrs),
  splitOnceByColon,
  tail
);

const getUrl = curry((baseUrl, url) => {
  if (!/(https|http)/.test(url)) {
    return { url: baseUrl + url };
  }
  return { url };
});

const fullfillM3u8 = curry((a, fn, b) => fn(a, b));

/** ------------- call -------------*/

const structureM3u8 = (m3u8, baseUrl) => {
  const getUrlWithBase = getUrl(baseUrl);
  return compose(
    map(ifElse(isTag, extractTag, getUrlWithBase)),
    tail,
    splitLines
  )(m3u8);
};

const compositionMaster = list => {
  const result = {
    medias: [],
    levels: []
  };
  const fullfillMaster = fullfillM3u8(result);

  const fullfillLevels = fullfillMaster((result, item) => {
    if (item.streamInf) {
      result.levels.push({
        id: result.levels.length,
        ...item.streamInf
      });
    }
    return item;
  });

  const fullfillIFrameLevels = fullfillMaster((result, item) => {
    if (item.iFrameStreamInf) {
      if (!result.iFrames) {
        result.iFrames = [{ id: 0, ...item.iFrameStreamInf }];
      } else {
        result.iFrames.push({
          id: result.iFrames.length,
          ...item.iFrameStreamInf
        });
      }
    }
    return item;
  });

  const fullfillMedias = fullfillMaster((result, item) => {
    if (item.media) {
      result.medias.push(item.media);
    }
    return item;
  });

  const fullfillLevelUrl = fullfillMaster((result, item) => {
    if (item.url) {
      result.levels[result.levels.length - 1].url = item.url;
    }
    return item;
  });

  const fullfillUniqueProp = fullfillMaster((result, item) => {
    if (!item.streamInf && !item.media && !item.url && !item.iFrameStreamInf) {
      Object.assign(result, item);
    }
  });

  forEach(
    compose(
      fullfillUniqueProp,
      fullfillLevelUrl,
      fullfillIFrameLevels,
      fullfillMedias,
      fullfillLevels
    )
  )(list);

  return result;
};

const compositionLevel = list => {
  const level = {
    segments: [],
    duration: 0
  };
  let lastCC = 0;
  const fullfillLevel = fullfillM3u8(level);

  const fullfillSegment = fullfillLevel((level, item) => {
    if (item.extinf) {
      let duration;
      let name;
      if (Array.isArray(item.extinf)) {
        // 存在两个属性[duration,name]
        [duration, name] = item.extinf;
      } else {
        duration = item.extinf;
      }
      duration = parseFloat(duration);
      let id = level.segments.length;
      let start = level.segments[id - 1] ? level.segments[id - 1].end : 0;
      let seg = {
        duration,
        start,
        end: start + duration,
        cc: lastCC
      };
      if (name) {
        seg.name = name;
      }
      level.segments.push({
        id: level.segments.length,
        ...seg
      });
      level.duration += duration;
    }
    return item;
  });

  const fullfillSegUrl = fullfillLevel((level, item) => {
    if (item.url) {
      level.segments[level.segments.length - 1].url = item.url;
    }
    return item;
  });

  const fullfillUniqueProp = fullfillLevel((result, item) => {
    if (item.extinf || item.url) return;
    if (item.discontinuity === true) {
      lastCC++;
    }
    for (let key in item) {
      if (level[key]) {
        level[key] = [level[key]];
        level[key].push(item[key]);
      } else {
        Object.assign(level, item);
      }
    }
  });

  forEach(
    compose(
      fullfillUniqueProp,
      fullfillSegUrl,
      fullfillSegment
    )
  )(list);

  return level;
};

const parse = (m3u8, baseUrl = '') => {
  if (!valid(m3u8)) return Error.INVALID;
  const list = structureM3u8(m3u8, baseUrl);
  let res = null;
  if (isMaster(m3u8)) {
    res = compositionMaster(list);
  } else {
    res = compositionLevel(list);
  }
  if (res.levels && res.levels.length === 0) {
    return Error.INVALID;
  }
  if (res.segments && res.segments.length === 0) {
    return Error.INVALID;
  }
  res.baseUrl = baseUrl;
  return res;
};

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
