import Mux from 'vod-fp-mux';
import { Tree, Row, Col } from 'antd';
import { array } from 'prop-types';

const { TreeNode } = Tree;

export default class Mp4Render extends React.Component {
  constructor(props) {
    super(props);
    let mp4Tree = Mux.Mp4Stringify(props.buffer);
    mp4Tree = this._convertMp4Stucture(mp4Tree);
    console.log(mp4Tree);
    this.state = {
      mp4Tree
    };
  }

  _convertMp4Stucture(list) {
    list.forEach(box => {
      if (box.data && Array.isArray(box.data)) {
        box.childs = this._convertMp4Stucture(box.data);
        delete box.data;
        box.props = { length: box.length };
        delete box.length;
      } else {
        box.props = Object.assign({}, box.data, { length: box.length });
        delete box.length;
        delete box.data;
        delete box.payload;
      }
    });
    return list;
  }

  _renderArrayPropOfObject(arr, parentKey) {
    arr = arr.map((item, index) => {
      let props = {};
      Object.keys(item).forEach(key => {
        if (typeof item[key] === 'object') {
          props = Object.assign({}, item, item[key]);
          delete props[key];
        } else {
          props[key] = item[key];
        }
      });
      return {
        type: index,
        props
      };
    });
    return this._renderChilds(arr, parentKey);
  }

  _renderProps(props, parentKey) {
    let keys = Object.keys(props);
    return keys.map((key, i) => {
      if (Array.isArray(props[key]) && typeof props[key][0] === 'object') {
        return this._renderArrayPropOfObject(props[key], parentKey + '-' + key);
      }
      let title = key + ':' + props[key];
      return <TreeNode title={title} key={parentKey + '-' + i}></TreeNode>;
    });
  }

  _renderChildsWithProps(box, parentKey) {
    return (
      <TreeNode title={box.type} key={parentKey}>
        {this._renderProps(box.props, parentKey + '-' + 1)}
        {this._renderChilds(box.childs, parentKey + '-' + 2)}
      </TreeNode>
    );
  }

  _renderChilds(data, parentKey) {
    return data.map((box, i) => {
      let key = parentKey + '-' + i;
      if (!box.childs) {
        return (
          <TreeNode title={box.type} key={key}>
            {this._renderProps(box.props, key)}
          </TreeNode>
        );
      }
      return this._renderChildsWithProps(box, key);
    });
  }

  render() {
    let { mp4Tree } = this.state;
    return (
      <Row>
        <Col span={24}>
          <h1>format: {this.props.format}</h1>
        </Col>
        <Col span={24}>
          <Tree showLine>{this._renderChilds(mp4Tree, 0)}</Tree>
        </Col>
      </Row>
    );
  }
}
