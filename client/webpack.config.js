//@ts-check

"use strict";

const path = require("path");
const webpack = require("webpack");

/**@type {import('webpack').Configuration}*/
const config = {
    target: "node", // target 'node' is needed for using functions from typescript library 📖 -> https://webpack.js.org/configuration/target/#target

    entry: path.resolve(__dirname, "src/extension.ts"), // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: "source-map",
    externals: {
        vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        fs: "commonjs fs",
        path: "commonjs path",
        child_process: "commonjs child_process",
        util: "commonjs util",
        glob: "commonjs glob",
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
            "@shared": path.resolve(__dirname, "src/shared/index.ts"),
        },
        fallback: {
            // Webpack 5 no longer polyfills Node.js core modules automatically.
            // see https://webpack.js.org/configuration/resolve/#resolvefallback
            // for the list of Node.js core module polyfills.
            os: false,
            process: require.resolve("process/browser"),
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
