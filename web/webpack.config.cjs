const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "src/main.jsx"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    publicPath: "/"
  },
  devtool: "eval-source-map",
  resolve: { extensions: [".js", ".jsx"] },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { targets: "defaults" }],
              ["@babel/preset-react", { runtime: "automatic" }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html")
    })
  ],
  devServer: {
    port: process.env.WEB_PORT,
    hot: true,
    historyApiFallback: true, // React Router refresh support
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:".concat(process.env.API_PORT),
        changeOrigin: true
      }
    ]
  }
};
