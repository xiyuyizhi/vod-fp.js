const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const fs = require('fs');

const ROOT = process.cwd();
const PACKAGE_ROOT = `packages/vod-fp-${process.env.BUILD}/`;

const config = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    filename: path.join(ROOT, PACKAGE_ROOT, 'src/index.js')
  },
  output: {
    library: 'Vod',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'this',
    filename: `vod-fp-${process.env.BUILD}.min.js`,
    path: path.join(ROOT, PACKAGE_ROOT, 'lib/')
  },
  resolve: {
    alias: {
      'vod-fp-utility': 'vod-fp-utility/src',
      'vod-fp-mux': 'vod-fp-mux/src',
      'vod-fp-player': 'vod-fp-player/src'
    }
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
        include: [
          /vod-fp-mux/,
          /vod-fp-player/,
          /vod-fp-utility/,
          new RegExp(path.join(PACKAGE_ROOT, '/src/'))
        ],
        loader: require.resolve('babel-loader'),
        options: {
          ...JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.babelrc')))
        }
      }
    ]
  }
};

module.exports = config;
