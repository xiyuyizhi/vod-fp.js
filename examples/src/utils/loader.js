export default function loader(url, { responseType }) {
  let defer = {};
  let controller = new AbortController();
  let pro = new Promise((resolve, reject) => {
    defer.resolve = resolve;
    defer.reject = reject;
  });

  let timer = setTimeout(() => {
    controller.abort();
    defer.resolve({
      code: 1,
      msg: 'timeout'
    });
  }, 10 * 1000);

  fetch(url, { signal: controller.signal })
    .then((res) => {
      clearTimeout(timer);
      if (res.status >= 200 && res.status < 300) return res;
      throw new Error(res.status + ':' + res.statusText);
    })
    .then((res) => res[responseType]())
    .then((data) => defer.resolve(data))
    .catch((e) => {
      defer.resolve({
        code: 1,
        msg: e.message
      });
    });

  return pro;
}
