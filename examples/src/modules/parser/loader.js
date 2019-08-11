export default function loader(url) {
  return fetch(url)
    .then(res => {
      if (res.status >= 200 && res.status < 300) return res;
      console.log(res.status, res.statusText);
      throw new Error(res.status + ':' + res.statusText);
    })
    .then(res => res.arrayBuffer());
}
