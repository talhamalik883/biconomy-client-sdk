/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css?$/,
        use: 'css-loader',
        exclude: /node_modules/
      },
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader',
        exclude: /node_modules/
      },
      {
        test: /\.png/,
        type: 'asset/resource',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    fallback: {
      url: require.resolve('url/'),
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify')
    },
    extensions: ['.tsx', '.ts', '.js', '.png', '.svg', '.css']
  },
  output: {
    path: path.resolve(__dirname, 'dist')
  }
}
