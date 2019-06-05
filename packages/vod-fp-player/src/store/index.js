const ACTION = {
  ERROR: 'error',
  COLLECT_MEDIA: 'collect_media',
  COLLECT_URL: 'collect_url',
  MEDIA_SOURCE_CREATE: 'media_source_create',
  PLAYLIST_LOADED: 'playlist_loaded'
};

let stores = [];

let storeId = 0;

function store() {
  const _store = {
    id: storeId++,
    connect: fn => {
      return fn(store);
    },
    dispatch: () => {},
    subscribe: () => {},
    getState: () => {}
  };
  stores.push(_store);
  return _store;
}

function connect(fn) {
  // let _connect_store = (id => {
  //   console.log(id);
  //   return stores[stores.length - 1];
  // })(storeId);
  let _connect_store = () => stores[stores.length - 1];
  return fn(_connect_store);
}

export { store, connect, ACTION };
