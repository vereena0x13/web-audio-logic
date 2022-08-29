/** @typedef {import("webpack").Configuration} Configuration */

const path = require('path');
const WorkerUrlPlugin = require('worker-url/plugin');

/** @type {Configuration} */
const config = {
    mode: "development",
    devtool: "inline-source-map",
    entry: {
        main: "./src/index.ts",
    },
    output: {
        publicPath: '/',
        path: path.resolve(__dirname, './dist'),
        filename: "index.js" // <--- Will be compiled to this single file
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: [
            { 
                test: /\.tsx?$/,
                loader: "ts-loader"
            }
        ]
    },
    plugins: [
        new WorkerUrlPlugin()
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 8080,
    }
};

module.exports = config