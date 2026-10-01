import { EndOfLine } from "vscode";
import { RequestType } from "@global_shared";
import { getCharacterForLineBreak } from "../../../../brunoFiles/shared/codeBlocksUtils/getCharacterForLineBreak";
import { getDefinitionsForBruObject } from "./getDefinitionsForBruObject";
import { getDefinitionsForReqObject } from "./getDefinitionsForReqObject";
import { getDefinitionsForResObject } from "./getDefinitionsForResObject";

/** The Bru class is globally available in Bruno but not exposed.
* There are also no types for it.
* This is a temporary workaround to get stop typescript from complaining and get intellisense.

* Official javascript API reference:
* https://docs.usebruno.com/scripting/javascript-reference*/
export function getDefinitionsForAllInbuiltLibraries(
    eol: EndOfLine,
    assignToGlobalObject = false,
    /** If undefined, the definitions for all request types are included. */
    requestType?: RequestType,
) {
    const isGrpc = requestType == RequestType.Grpc;
    const bruObjectDefinitions = getDefinitionsForBruObject(
        requestType == undefined || isGrpc,
    );
    // `req` and `res` are not available for GRPC requests.
    const reqObjectDefinitions = isGrpc
        ? undefined
        : getDefinitionsForReqObject();
    const resObjectDefinitions = isGrpc
        ? undefined
        : getDefinitionsForResObject();
    const chaiAndMochaTestUtils = `const { expect } = require("chai");
const { test } = require("mocha")`;

    const globalAssignments = `globalThis.bru = bru;
${isGrpc ? "" : "globalThis.req = req;\nglobalThis.res = res;\n"}globalThis.expect = expect;
globalThis.test = test;`;

    return [
        bruObjectDefinitions,
        reqObjectDefinitions,
        resObjectDefinitions,
        chaiAndMochaTestUtils,
    ]
        .filter((text): text is string => text !== undefined)
        .concat(assignToGlobalObject ? [globalAssignments] : [])
        .map((text) =>
            text.replace(/(\r\n|\n)/g, getCharacterForLineBreak(eol)),
        );
}
