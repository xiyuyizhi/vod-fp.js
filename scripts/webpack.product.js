const path = require('path');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const TerserPlugin = require('terser-webpack-plugin');

const ROOT = process.cwd();

const config = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    filename: path.join(ROOT, 'src/index.js')
  },
  output: {
    path: path.join(ROOT, 'lib/'),
    filename: 'vod-fp.min.js'
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false
          },
          mangle: {
            safari10: true
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true
          }
        },
        parallel: true,
        cache: true,
        sourceMap: true
      })
    ]
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.js$/,
        include: [/src/],
        loader: require.resolve('babel-loader')
      }
    ]
  }
};

module.exports = config;
