//@ts-check

"use strict";

const path = require("path");
const webpack = require("webpack");

/**@type {import('webpack').Configuration}*/
const config = {
    target: "node", // target 'node' is needed for using functions from typescript library 📖 -> https://webpack.js.org/configuration/target/#target

    entry: "./src/server.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, "dist"),
        filename: "server.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: "source-map",
    externals: {
        fs: "commonjs fs",
        path: "commonjs path",
        util: "commonjs util",
        prettier: "commonjs prettier",
        "timers/promises": "commonjs timers/promises",
    },
    resolve: {
        // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
        extensions: [".ts", ".js"],
        alias: {
            // provides alternate implementation for node module and source files
            "@global_shared": path.resolve(
                path.dirname(__dirname),
                "shared/index.ts",
            ),
        },
        fallback: {
            // Webpack 5 no longer polyfills Node.js core modules automatically.
            // see https://webpack.js.org/configuration/resolve/#resolvefallback
            // for the list of Node.js core module polyfills.
            os: false,
        },
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                    options: {
                        projectReferences: true,
                    },
                },
            },
        ],
    },
};
module.exports = config;
