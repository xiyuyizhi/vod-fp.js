import { Maybe, F, Tick } from 'vod-fp-utility';
import { ACTION } from '../store';

const { curry } = F;

const CLASSNMAE = {
  VOD_MENU_CLASSNAME: 'vod-context-menu',
  VOD_MENU_CLOSE: 'vod-menu-close',
  VOD_DEBUG_BTN: 'vod-debug-btn',
  VOD_DEBUG_INFO: 'vod-debug-info',
  VOD_DEBUG_INFO_CLOSE: 'vod-debug-info-close',
  VOD_DEBUG_INFO_AREA: 'vod-debug-info-area'
};

const defaultStyle = {
  position: 'absolute',
  padding: '10px',
  'font-size': '12px',
  background: '#000',
  opacity: '0.8',
  color: 'white'
};

const closeIconStyle = {
  'text-align': 'right',
  cursor: 'pointer'
};

const debugInfoUlStyle = {
  'list-style': 'none',
  padding: 0,
  'text-align': 'left'
};

const debugInfoItemStyle = {
  display: 'inline-block',
  width: '110px',
  'text-align': 'right',
  'margin-right': '20px'
};

function _initDebugWindow(container, connect) {
  let _window;
  let _task;
  _window = document.createElement('div');
  _window.className = CLASSNMAE.VOD_DEBUG_INFO;
  _window.style.width = '250px';
  _window.style.left = `20px`;
  _window.style.top = `20px`;
  Object.assign(_window.style, defaultStyle);

  _window.innerHTML = `
    <div style="${_parseStyleStr(closeIconStyle)}" class="${
    CLASSNMAE.VOD_DEBUG_INFO_CLOSE
  }">X</div>
    <div class="${CLASSNMAE.VOD_DEBUG_INFO_AREA}"></div>
  `;

  let debugCloseHandler = e => {
    if (e.target.className === CLASSNMAE.VOD_DEBUG_INFO_CLOSE) {
      _window.removeEventListener('click', debugCloseHandler);
      container.removeChild(_window);
      if (_task) {
        _task.destroy();
      }
    }
  };

  _window.addEventListener('click', debugCloseHandler);
  container.appendChild(_window);
  _task = _startFlush(_window, connect);
}

function _startFlush(container, connect) {
  let ele = container.querySelector(`.${CLASSNMAE.VOD_DEBUG_INFO_AREA}`);
  return Tick.of()
    .addTask(() => {
      _renderDebugInfo(connect(_collectDebugInfo), ele);
    })
    .interval(500)
    .immediateRun();
}

function _collectDebugInfo({ getState, getConfig }) {
  let bufferInfo = getState(ACTION.BUFFER.GET_BUFFER_INFO).value();
  let flyBufferInfo = getState(ACTION.BUFFER.GET_FLY_BUFFER_INFO).value();
  let videoInfo = getState(ACTION.BUFFER.VIDEO_INFO).value();
  let audioInfo = getState(ACTION.BUFFER.AUDIO_INFO).value();
  let speed = getState(ACTION.LOADINFO.GET_DOWNLOAD_SPEED).value();
  let currentLevelId = getState(ACTION.PLAYLIST.CURRENT_LEVEL_ID).value();
  let media = getState(ACTION.MEDIA.MEDIA_ELE).value();

  let flyBuffer = flyBufferInfo.bufferLength.toFixed(2);
  let buffer = bufferInfo.bufferLength.toFixed(2);
  let maxFlyBuffer = getConfig(ACTION.CONFIG.MAX_FLY_BUFFER_LENGTH);
  let maxBuffer = getConfig(ACTION.CONFIG.MAX_BUFFER_LENGTH);
  return {
    bufferInfo: buffer + ' / ' + maxBuffer,
    flyBufferInfo: flyBuffer + ' / ' + maxFlyBuffer,
    format: getState(ACTION.PLAYLIST.FORMAT),
    mode: getState(ACTION.PLAYLIST.MODE),
    videoWidth: (videoInfo && videoInfo.width) || '--',
    videoHeight: (videoInfo && videoInfo.height) || '--',
    videoCodec: (videoInfo && videoInfo.codec) || '--',
    fps: (videoInfo && videoInfo.fps) || '--',
    audioCodec: (audioInfo && audioInfo.codec) || '--',
    samplerate: (audioInfo && audioInfo.samplerate) || '--',
    speed:
      (buffer > maxBuffer && media.paused) ||
      flyBuffer >= maxFlyBuffer ||
      Math.abs(flyBufferInfo.bufferEnd - media.duration) < 1
        ? '0KB/s'
        : speed > 1
        ? speed.toFixed(2) + 'MB/s'
        : (speed * 1000).toFixed(2) + 'KB/s',
    currentLevelId
  };
}

function _parseStyleStr(styles) {
  return Object.keys(styles)
    .map(key => `${key}:${styles[key]}`)
    .join(';');
}

function _renderDebugInfo(info, ele) {
  let _lis = [
    'format',
    'mode',
    'videoCodec',
    'audioCodec',
    'videoWidth',
    'videoHeight',
    'samplerate',
    'fps',
    'bufferInfo',
    'flyBufferInfo',
    'speed',
    {
      key: 'currentLevelId',
      label: 'current load level'
    }
  ]
    .map(x => {
      if (typeof x === 'string') {
        return `<li><span style="${_parseStyleStr(
          debugInfoItemStyle
        )}">${x}:</span>${info[x]}</li>`;
      }
      return `<li><span style="${_parseStyleStr(debugInfoItemStyle)}">${
        x.label
      }:</span>${info[x.key]}</li>`;
    })
    .join('\n');

  ele.innerHTML = `<div><ul style="${_parseStyleStr(
    debugInfoUlStyle
  )}">${_lis}</ul></div>`;
}

function _renderContextMenu(pointX, pointY, container, connect) {
  let menu;
  menu = document.createElement('div');
  menu.className = CLASSNMAE.VOD_MENU_CLASSNAME;
  menu.style.width = '80px';
  menu.style.left = `${pointX}px`;
  menu.style.top = `${pointY}px`;
  Object.assign(menu.style, defaultStyle);
  menu.innerHTML = `
    <div style="${_parseStyleStr(closeIconStyle)}" class="${
    CLASSNMAE.VOD_MENU_CLOSE
  }">X</div>
    <div style="cursor:pointer" class="${
      CLASSNMAE.VOD_DEBUG_BTN
    }">调试信息</div>
  `;
  menu.addEventListener('click', e => {
    switch (e.target.className) {
      case CLASSNMAE.VOD_MENU_CLOSE:
        container.removeChild(menu);
        break;
      case CLASSNMAE.VOD_DEBUG_BTN:
        container.removeChild(menu);
        _initDebugWindow(container, connect);
        break;
    }
  });
  container.appendChild(menu);
}

function debuger({ connect }, container) {
  container.contextMenuHandler = e => {
    e.preventDefault();
    _renderContextMenu(e.offsetX, e.offsetY, container, connect);
  };
  container.addEventListener('contextmenu', container.contextMenuHandler);
}

function clearDebuger(container) {
  if (!container) return;
  container.removeEventListener('contextmenu', container.contextMenuHandler);
  let menu = container.querySelector(`.${CLASSNMAE.VOD_MENU_CLASSNAME}`);
  if (menu) {
    container.removeChild(menu);
  }
  let debugerCloseBtn = document.querySelector(
    `.${CLASSNMAE.VOD_DEBUG_INFO_CLOSE}`
  );
  if (debugerCloseBtn) {
    // remove task
    debugerCloseBtn.click();
  }
}

debuger = curry(debuger);
export { debuger, clearDebuger };
