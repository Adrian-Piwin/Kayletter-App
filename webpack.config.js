const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    devtool: "eval-cheap-source-map",
    mode: 'development',
    entry: './src/index.js',
    devServer: {
        static: './dist',
      },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html',
            inject: 'body'
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/login.html',
            filename: 'login.html',
            inject: 'body'
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/input.html',
            filename: 'input.html',
            inject: 'body'
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/display.html',
            filename: 'display.html',
            inject: 'body'
        })
    ]
}
