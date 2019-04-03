const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ROOT = process.cwd();

const getEntry = () => {
  if (process.env.DEV === 'mux') {
    return {
      filename: path.join(ROOT, 'demo/mux.js')
    };
  }
  return {
    filename: path.join(ROOT, 'demo/index.js')
  };
};

const config = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: getEntry(),
  output: {
    path: path.join(ROOT, 'dist'),
    filename: 'bundle.js'
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
    geneTemps()
  ],
  devServer: {
    contentBase: [path.join(ROOT, 'dist'), path.join(ROOT, 'lib')],
    compress: true,
    port: 9000
  }
};

function geneTemps() {
  if (process.env.DEV === 'mux') {
    return new HtmlWebpackPlugin({
      template: 'demo/mux.html',
      filename: 'mux.html'
    });
  }
  return new HtmlWebpackPlugin({
    template: 'demo/index.html',
    filename: 'index.html'
  });
}

module.exports = config;
