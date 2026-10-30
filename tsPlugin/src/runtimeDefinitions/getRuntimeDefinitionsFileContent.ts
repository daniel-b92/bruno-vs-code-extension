import { getDefinitionsForBruObject } from "./getDefinitionsForBruObject";
import { getDefinitionsForReqObject } from "./getDefinitionsForReqObject";
import { getDefinitionsForResObject } from "./getDefinitionsForResObject";

let content: string | undefined;

/**
 * The Bru class is globally available in Bruno but not exposed.
 * There are also no types for it, so the types for the objects that are provided at runtime are defined here (as Javascript with JSDoc types).
 *
 * Official javascript API reference:
 * https://docs.usebruno.com/scripting/javascript-reference
 *
 * The file must not be a module (no `require`, `import` or `export`), so that all declarations in it are global.
 * `chai` and `mocha` are resolved from the `node_modules` of the collection, so the file needs to be located within the collection.
 */
export function getRuntimeDefinitionsFileContent() {
    content ??= [
        getDefinitionsForBruObject(),
        getDefinitionsForReqObject(),
        getDefinitionsForResObject(),
        `/** @type {typeof import("chai").expect} */
var expect;
/** @type {typeof import("mocha").test} */
var test;`,
        getTypeDefinitionsForGrpcScripts(),
        getWrapperVariableDefinitions(),
        getScriptPathDefinitions(),
    ].join("\n\n");

    return content;
}

/**
 * `bru.grpc.response` is only available after the response was received. `bru.grpc.request` is available in all hooks.
 * `bru.cookies` and `bru.runner` are not available in gRPC scripts.
 * The types are used for the parameters that shadow `bru` within the code blocks of gRPC requests (see `getBlockWrapperCandidates`).
 */
function getTypeDefinitionsForGrpcScripts() {
    return `/** @typedef {Omit<typeof bru, "grpc" | "cookies" | "runner"> & { grpc: Pick<typeof bru.grpc, "request"> }} ${grpcBruTypeNames.preRequest} */
/** @typedef {Omit<typeof bru, "cookies" | "runner">} ${grpcBruTypeNames.postResponse} */`;
}

/**
 * Only available in Developer Mode. Directory of the current script (collection, folder or request directory).
 */
function getScriptPathDefinitions() {
    return `/** @type {string} */
var __dirname;
/** @type {string} */
var __filename;`;
}

/**
 * The code blocks are wrapped in arrow functions that are assigned to these variables (see `getBlockWrapperCandidates`).
 * That way, the types of the parameters that shadow the unavailable objects are inferred from the variable and do not need to be written in the (very limited) space in front of the code block.
 * The names are kept short for the same reason.
 */
function getWrapperVariableDefinitions() {
    return `/** @type {(res: undefined) => any} */
var ${wrapperVariableNames.preRequest};
/** @type {(bru: ${grpcBruTypeNames.preRequest}) => any} */
var ${wrapperVariableNames.grpcPreRequest};
/** @type {(bru: ${grpcBruTypeNames.postResponse}) => any} */
var ${wrapperVariableNames.grpcPostResponse};`;
}

export const wrapperVariableNames = {
    preRequest: "$bP",
    grpcPreRequest: "$gP",
    grpcPostResponse: "$gR",
};

export const grpcBruTypeNames = {
    preRequest: "BruForPreRequestGrpc",
    postResponse: "BruForPostResponseGrpc",
};
