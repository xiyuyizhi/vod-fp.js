const path = require('path');
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
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.js$/,
        include: [
          new RegExp(path.join(PACKAGE_ROOT, '/demo/')),
          new RegExp(path.join(PACKAGE_ROOT, '/src/'))
        ],
        loader: require.resolve('babel-loader')
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
    port: process.env.PORT
  }
};

module.exports = config;
