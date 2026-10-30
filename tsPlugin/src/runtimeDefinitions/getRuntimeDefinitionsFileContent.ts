import {
    getDefinitionsForBruObject,
    getDefinitionsForGrpcSubobject,
} from "./getDefinitionsForBruObject";
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
    ].join("\n\n");

    return content;
}

/**
 * `bru.grpc` is only available for gRPC requests. `bru.grpc.request` is only available before the request is sent
 * and `bru.grpc.response` only after the response was received.
 * The types are used for the parameters that shadow `bru` within the code blocks of gRPC requests (see `getBlockWrapperCandidates`).
 * The global `bru` object does not have the `grpc` property, so it is defined in a separate variable.
 */
function getTypeDefinitionsForGrpcScripts() {
    return `var ${grpcObjectVariableName} = ${getDefinitionsForGrpcSubobject()};

/** @typedef {typeof bru & { grpc: Pick<typeof ${grpcObjectVariableName}, "request"> }} ${grpcBruTypeNames.preRequest} */
/** @typedef {typeof bru & { grpc: Pick<typeof ${grpcObjectVariableName}, "response"> }} ${grpcBruTypeNames.postResponse} */`;
}

/**
 * The code blocks are wrapped in arrow functions that are assigned to these variables (see `getBlockWrapperCandidates`).
 * That way, the types of the parameters that shadow the unavailable objects are inferred from the variable and do not need to be written in the (very limited) space in front of the code block.
 * The names are kept short for the same reason.
 * Since all unavailable objects have the type `undefined`, they are declared as a rest parameter and can be passed in any order.
 */
function getWrapperVariableDefinitions() {
    return `/** @type {(...unavailableObjects: undefined[]) => any} */
var ${wrapperVariableNames.unavailableObjects};
/** @type {(bru: ${grpcBruTypeNames.preRequest}, ...unavailableObjects: undefined[]) => any} */
var ${wrapperVariableNames.grpcPreRequest};
/** @type {(bru: ${grpcBruTypeNames.postResponse}, ...unavailableObjects: undefined[]) => any} */
var ${wrapperVariableNames.grpcPostResponse};`;
}

export const wrapperVariableNames = {
    unavailableObjects: "$bU",
    grpcPreRequest: "$gP",
    grpcPostResponse: "$gR",
};

export const grpcObjectVariableName = "$grpc";

export const grpcBruTypeNames = {
    preRequest: "BruForPreRequestGrpc",
    postResponse: "BruForPostResponseGrpc",
};
