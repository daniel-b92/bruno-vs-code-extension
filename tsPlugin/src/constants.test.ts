import { describe, it, expect } from "@jest/globals";
import { InbuiltFunctionName } from "../../shared/languageUtils/bruFormat/contentInterfaces";
import { ScriptType as ScriptTypeFromExtension } from "../../shared/fileParsing/external/yamlFormat/constants/sharedConstants";
import {
    ScriptType,
    getNamesForInbuiltFunctionsWithVariableName,
} from "./constants";

describe("ScriptType", () => {
    // The plugin is published as a separate package, so it cannot import the constants from the extension.
    it("is equal to the script types known to the extension", () => {
        expect(Object.values(ScriptType)).toEqual(
            Object.values(ScriptTypeFromExtension),
        );
    });
});

describe("getNamesForInbuiltFunctionsWithVariableName", () => {
    it("is equal to the inbuilt functions known to the extension", () => {
        expect(getNamesForInbuiltFunctionsWithVariableName()).toEqual(
            Object.values(InbuiltFunctionName),
        );
    });
});
