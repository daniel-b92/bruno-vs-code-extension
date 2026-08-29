import { EndOfLine } from "vscode";
import { getCharacterForLineBreak } from "../../../../brunoFiles/shared/codeBlocksUtils/getCharacterForLineBreak";
import { getDefinitionsForBruObject } from "./getDefinitionsForBruObject";
import { getDefinitionsForReqObject } from "./getDefinitionsForReqObject";
import { getDefinitionsForResObject } from "./getDefinitionsForResObject";

/** The Bru class is globally available in Bruno but not exposed.
* There are also no types for it.
* This is a temporary workaround to get stop typescript from complaining and get intellisense.

* Official javascript API reference:
* https://docs.usebruno.com/testing/script/javascript-reference*/
export function getDefinitionsForAllInbuiltLibraries(
    eol: EndOfLine,
    assignToGlobalObject = false,
) {
    const bruObjectDefinitions = getDefinitionsForBruObject();
    const reqObjectDefinitions = getDefinitionsForReqObject();
    const resObjectDefinitions = getDefinitionsForResObject();
    const chaiAndMochaTestUtils = `const { expect } = require("chai");
const { test } = require("mocha")`;

    const globalAssignments = `globalThis.bru = bru;
globalThis.req = req;
globalThis.res = res;
globalThis.expect = expect;
globalThis.test = test;`;

    return [
        bruObjectDefinitions,
        reqObjectDefinitions,
        resObjectDefinitions,
        chaiAndMochaTestUtils,
    ]
        .concat(assignToGlobalObject ? [globalAssignments] : [])
        .map((text) =>
            text.replace(/(\r\n|\n)/g, getCharacterForLineBreak(eol)),
        );
}
