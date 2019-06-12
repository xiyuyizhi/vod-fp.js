const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ROOT = process.cwd();
const PACKAGE_ROOT = `packages/vod-fp-${process.env.DEV}/`;

const config = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    filename: path.join(ROOT, PACKAGE_ROOT, 'demo/demo.js')
  },
  output: {
    path: path.join(ROOT, 'dist'),
    filename: 'bundle.js'
  },
  resolve: {
    alias: {
      'vod-fp-utility': 'vod-fp-utility/src',
      'vod-fp-mux': 'vod-fp-mux/src',
      'vod-fp-player': 'vod-fp-player/src'
    }
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.js$/,
        include: [
          /vod-fp-mux/,
          /vod-fp-utility/,
          /vod-fp-player/,
          new RegExp(path.join(PACKAGE_ROOT, '/demo/')),
          new RegExp(path.join(PACKAGE_ROOT, '/src/'))
        ],
        loader: require.resolve('babel-loader'),
        options: {
          ...JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.babelrc')))
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(ROOT, PACKAGE_ROOT, 'demo/demo.html'),
      filename: 'index.html'
    })
  ],
  devServer: {
    compress: true,
    disableHostCheck: true,
    port: process.env.PORT,
    host: '0.0.0.0'
  }
};

module.exports = config;
