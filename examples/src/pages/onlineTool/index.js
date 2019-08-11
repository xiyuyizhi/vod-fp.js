import Parser from 'modules/parser';

import '../index/index.less';

ReactDOM.render(<Parser />, document.getElementById('root'));

if (module.hot) {
  module.hot.accept(() => {});
}
