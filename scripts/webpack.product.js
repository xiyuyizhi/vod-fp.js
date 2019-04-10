const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const ROOT = process.cwd();
const PACKAGE_ROOT = `packages/vod-fp-${process.env.BUILD}/`;

const config = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    filename: path.join(ROOT, PACKAGE_ROOT, 'src/index.js')
  },
  output: {
    libraryTarget: 'umd',
    path: path.join(ROOT, PACKAGE_ROOT, 'lib/'),
    filename: `vod-fp-${process.env.BUILD}.min.js`
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
        include: [/vod-fp-mux/, /vod-fp-player/, /vod-fp-utility/, /src/],
        loader: require.resolve('babel-loader')
      }
    ]
  }
};

module.exports = config;
