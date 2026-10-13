import { describe, it, expect } from "@jest/globals";
import { ScriptType as ScriptTypeFromExtension } from "../../shared/fileParsing/external/yamlFormat/constants/sharedConstants";
import { ScriptType } from "./constants";

describe("ScriptType", () => {
    // The plugin is published as a separate package, so it cannot import the constants from the extension.
    it("is equal to the script types known to the extension", () => {
        expect(Object.values(ScriptType)).toEqual(
            Object.values(ScriptTypeFromExtension),
        );
    });
});
