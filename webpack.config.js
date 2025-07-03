const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist-bundled'),
    libraryTarget: 'commonjs2',
  },
  externals: {
    // Keep native modules external if needed
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
  ],
  optimization: {
    minimize: false, // Keep readable for debugging
  },
};