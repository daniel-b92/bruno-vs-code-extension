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
    ].join("\n\n");

    return content;
}

/**
 * `bru.grpc.request` is only available before the request is sent.
 * `bru.grpc.response` is only available after the response was received.
 * The types are used for the parameters that shadow `bru` within the code blocks of gRPC requests (see `getBlockWrapperCandidates`).
 */
function getTypeDefinitionsForGrpcScripts() {
    return `/** @typedef {Omit<typeof bru, "grpc"> & { grpc: Pick<typeof bru.grpc, "request"> }} ${grpcBruTypeNames.preRequest} */
/** @typedef {Omit<typeof bru, "grpc"> & { grpc: Pick<typeof bru.grpc, "response"> }} ${grpcBruTypeNames.postResponse} */`;
}

export const grpcBruTypeNames = {
    preRequest: "BruForPreRequestGrpc",
    postResponse: "BruForPostResponseGrpc",
};
