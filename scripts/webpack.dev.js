const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ROOT = process.cwd();

const config = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    filename: path.join(ROOT, 'demo/index.js')
  },
  output: {
    path: path.join(ROOT, 'dist'),
    filename: 'build.js'
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.js$/,
        include: [/demo/, /src/],
        loader: require.resolve('babel-loader')
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: false,
      template: 'demo/build.html',
      filename: 'build.html'
    }),
    new HtmlWebpackPlugin({
      template: 'demo/index.html',
      filename: 'index.html'
    })
  ],
  devServer: {
    contentBase: [path.join(ROOT, 'dist'), path.join(ROOT, 'lib')],
    compress: true,
    port: 9000
  }
};

module.exports = config;
