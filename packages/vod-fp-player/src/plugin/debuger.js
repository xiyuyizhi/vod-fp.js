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
  padding: '15px',
  background: '#000',
  opacity: '0.8',
  color: 'white'
};

function _initDebugWindow(container, connect) {
  let _window;
  let _task;
  _window = container.querySelector(`.${CLASSNMAE.VOD_DEBUG_INFO}`);
  if (_window) {
    _window.style.display = 'block';
    _task = _startFlush(_window, connect);
    return;
  }
  _window = document.createElement('div');
  _window.className = CLASSNMAE.VOD_DEBUG_INFO;
  _window.style.width = '220px';
  _window.style.left = `10px`;
  _window.style.top = `10px`;
  Object.assign(_window.style, defaultStyle);
  _window.innerHTML = `
    <div style="text-align:right;cursor:pointer" class="${
      CLASSNMAE.VOD_DEBUG_INFO_CLOSE
    }">X</div>
    <div class="${CLASSNMAE.VOD_DEBUG_INFO_AREA}"></div>
  `;
  _window.addEventListener('click', e => {
    if (e.target.className === CLASSNMAE.VOD_DEBUG_INFO_CLOSE) {
      _window.style.display = 'none';
      if (_task) {
        _task.stop();
      }
    }
  });
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
  return Maybe.of(
    curry((bufferInfo, flyBufferInfo) => {
      return {
        bufferLength: bufferInfo.bufferLength,
        flyBufferLength: flyBufferInfo.bufferLength,
        maxBufferLength: getConfig(ACTION.CONFIG.MAX_BUFFER_LENGTH),
        maxFlyBufferLength: getConfig(ACTION.CONFIG.MAX_FLY_BUFFER_LENGTH)
      };
    })
  )
    .ap(getState(ACTION.BUFFER.GET_BUFFER_INFO))
    .ap(getState(ACTION.BUFFER.GET_FLY_BUFFER_INFO))
    .join();
}

function _renderDebugInfo(info, ele) {
  ele.innerHTML = `<div>
  <ul style="list-style:none;padding:0">
    <li><span style="display: inline-block; width: 120px;">buffer信息:</span>${info.bufferLength.toFixed(
      2
    )} / ${info.maxBufferLength}s</li>
    <li><span style="display: inline-block; width: 120px;">虚拟buffer信息:</span>${info.flyBufferLength.toFixed(
      2
    )} / ${info.maxFlyBufferLength}s</li>
  </ul>
  </div>`;
}

function _renderContextMenu(pointX, pointY, container, connect) {
  let menu;
  menu = container.querySelector(`.${CLASSNMAE.VOD_MENU_CLASSNAME}`);
  if (menu) {
    menu.style.display = 'block';
    return;
  }
  menu = document.createElement('div');
  menu.className = CLASSNMAE.VOD_MENU_CLASSNAME;
  menu.style.width = '80px';
  menu.style.left = `${pointX}px`;
  menu.style.top = `${pointY}px`;
  Object.assign(menu.style, defaultStyle);
  menu.innerHTML = `
    <div style="text-align:right;cursor:pointer" class="${
      CLASSNMAE.VOD_MENU_CLOSE
    }">X</div>
    <div style="cursor:pointer" class="${
      CLASSNMAE.VOD_DEBUG_BTN
    }">调试信息</div>
  `;
  menu.addEventListener('click', e => {
    switch (e.target.className) {
      case CLASSNMAE.VOD_MENU_CLOSE:
        menu.style.display = 'none';
        break;
      case CLASSNMAE.VOD_DEBUG_BTN:
        menu.style.display = 'none';
        _initDebugWindow(container, connect);
        break;
    }
  });
  container.appendChild(menu);
}

function _bindEvent(container, connect) {
  container.addEventListener('contextmenu', e => {
    e.preventDefault();
    _renderContextMenu(e.offsetX, e.offsetY, container, connect);
  });
}

function debuger({ connect }, container) {
  _bindEvent(container, connect);
}

export default curry(debuger);
