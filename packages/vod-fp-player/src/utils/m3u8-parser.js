/**
 * https://tools.ietf.org/html/draft-pantos-http-live-streaming-23
 */

import { F, Maybe, Success, Fail, CusError, either } from 'vod-fp-utility';
import { M3U8_PARSE_ERROR } from '../error';

const {
  curry,
  prop,
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
  chain,
  trace
} = F;

const TAG_PATTERN = /EXT(?:-X-)(.+)/;
const SPLIT_COMMA_PATTERN = /,(?:(?=[a-zA-Z-]+(?:=|"|$)))/;
const splitOnceByColon = splitOnce(':');
const splitOnceByEq = splitOnce('=');
const splitByComma = split(SPLIT_COMMA_PATTERN);
const splitByAcross = split('-');
const filterEmpty = filter(a => Boolean(a) && a !== ',');

const DISCONTINUITY_TAG = 'discontinuity';
const END_TAG = 'endlist';

const isTag = line => line.trim().indexOf('#EXT') === 0;
const splitLines = m3u8 =>
  m3u8
    .split(/\n/)
    .filter(Boolean)
    .filter(x => /^(#EXT|[^#])/.test(x))
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

const combinePair = curry((baseUrl, args) => {
  let [key, value] = args;
  if (key === DISCONTINUITY_TAG) {
    return { discontinuity: true };
  }
  if (key === END_TAG) {
    return { live: false };
  }
  if (key === 'uri' || key === 'url') {
    return { [key]: getUrl(baseUrl, value).url };
  }
  if (!value) return {};
  if (value.length === 1) {
    value = value[0];
    value = isNaN(value) ? value : Number(value);
  }
  return { [key]: value };
});

const combineObjs = list => {
  let specialAttrs = list.every(x => typeof x !== 'object');
  if (!specialAttrs) {
    return list.reduce((all, obj) => Object.assign(all, obj), {});
  }
  return list;
};

const extractAttrs = curry((baseUrl, attrs) => {
  const extractAttr = compose(
    ifElse(
      x => x.length === 1,
      head, //eg: EXTINF:duration
      compose(
        combinePair(baseUrl),
        splitMap(keyFormat, identity)
      ) // eg: EXT-X-MEDIA:TYPE=AUDIO,URI="XXXX"
    ),
    splitOnceByEq
  );
  return compose(
    combineObjs,
    map(extractAttr),
    filterEmpty,
    splitByComma
  )(attrs);
});

const extractTag = curry((baseUrl, tag) => {
  return compose(
    combinePair(baseUrl),
    splitMap(keyFormat, extractAttrs(baseUrl)),
    splitOnceByColon,
    tail
  )(tag);
});

const getUrl = curry((baseUrl, url) => {
  if (!/^https?/.test(url)) {
    return {
      url: Array.from(new Set(baseUrl.split('/').concat(url.split('/')))).join('/')
    };
  }
  return { url };
});

const fullfillM3u8 = curry((a, fn, b) => fn(a, b));

/** ------------- call -------------*/

const structureM3u8 = curry((baseUrl, m3u8) => {
  const getUrlWithBase = getUrl(baseUrl);
  return compose(
    map(ifElse(isTag, extractTag(baseUrl), getUrlWithBase)),
    tail,
    filter(Boolean),
    splitLines
  )(m3u8);
});

const compositionMaster = list => {
  const result = {
    type: 'master',
    medias: [],
    levels: []
  };
  const fullfillMaster = fullfillM3u8(result);
  const fullfillLevels = fullfillMaster((result, item) => {
    if (item.streamInf) {
      result.levels.push(item.streamInf);
    }
    return item;
  });

  const fullfillIFrameLevels = fullfillMaster((result, item) => {
    if (item.iFrameStreamInf) {
      if (!result.iFrames) {
        result.iFrames = [
          {
            id: 0,
            ...item.iFrameStreamInf
          }
        ];
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
      let len = result.levels.length;
      result.levels[len - 1].url = item.url;
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
  result.levels.sort((a, b) =>
    parseFloat(a.bandwidth) > parseFloat(b.bandwidth) ? 1 : -1
  );
  result.levels.forEach((x, index) => {
    x.levelId = index + 1;
  });
  return result;
};

const compositionLevel = curry(list => {
  const level = {
    type: 'level',
    segments: [],
    duration: 0,
    startSN: 0,
    endSN: 0,
    live: true
  };
  let lastCC = 0;
  let mediaSequence = 0;
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
      // segment structure
      let seg = {
        duration,
        start,
        end: start + duration,
        cc: lastCC
      };
      if (name) {
        seg.name = name;
      }
      let sn = mediaSequence + level.segments.length;
      level.segments.push({
        id: sn,
        ...seg
      });
      level.startSN = level.startSN || sn;
      level.endSN = sn;
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
      return;
    }
    if (item.live !== undefined) {
      Object.assign(level, item);
      return;
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
      fullfillSegment,
      item => {
        if (item.mediaSequence) {
          mediaSequence = item.mediaSequence;
        }
        return item;
      }
    )
  )(list);
  return level;
});

// string -> Either
const valid = m3u8 => {
  if (m3u8 && m3u8.indexOf('#EXTM3U') !== -1) {
    return Success.of(m3u8);
  }
  return Fail.of(CusError.of(M3U8_PARSE_ERROR.INVALID));
};

const isMaster = m3u8 => m3u8.indexOf('EXT-X-STREAM-INF') !== -1;

function _getBasePath(url) {
  url = url.split('?');
  url = url[0];
  return url.slice(0, url.lastIndexOf('/') + 1);
}

// (string,string) -> Either
export default curry((url, m3u8) => {
  // throw new Error(a);
  let baseUrl = _getBasePath(url);
  const handleMaster = compose(
    compositionMaster,
    structureM3u8(baseUrl)
  );

  const handleLevel = compose(
    compositionLevel,
    structureM3u8(baseUrl)
  );

  // object -> Either
  const usableCheck = res => {
    if (res.levels && res.levels.length === 0) {
      return Fail.of(CusError.of(M3U8_PARSE_ERROR.INVALID));
    }
    if (res.segments && res.segments.length === 0) {
      return Fail.of(CusError.of(M3U8_PARSE_ERROR.INVALID));
    }
    return Success.of(res);
  };
  const handle = compose(
    map(x => {
      x.baseUrl = baseUrl;
      x.url = url;
      return x;
    }),
    chain(usableCheck),
    map(ifElse(isMaster, handleMaster, handleLevel)),
    valid
  );
  return handle(m3u8).error(e => {
    return e.getOrElse(CusError.of(M3U8_PARSE_ERROR.PARSE_ERROR));
  });
});
