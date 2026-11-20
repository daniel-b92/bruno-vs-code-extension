import { describe, expect, it } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import { isPositionWithinNameOfVariable } from "./inbuiltFunctionParameters";

describe("isPositionWithinNameOfVariable", () => {
    it.each(["hasEnvVar", "hasVar", "hasGlobalEnvVar", "deleteGlobalEnvVar"])(
        "delegates the variable name in bru.%s to the extension",
        (functionName) => {
            expect(isVariableName(`bru.${functionName}("token");`)).toBe(true);
        },
    );

    it.each([
        'other.hasEnvVar("token");',
        'bru.hasEnvVar("other", "token");',
        'bru.hasEnvVar(value); const token = "unrelated";',
    ])("does not delegate an unrelated position in %s", (content) => {
        expect(isVariableName(content)).toBe(false);
    });
});

function isVariableName(content: string) {
    const fileName = "/collection/script.js";
    const sourceFile = ts.createSourceFile(
        fileName,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
    );
    const info = {
        languageService: {
            getProgram: () => ({ getSourceFile: () => sourceFile }),
        },
    } as unknown as ts.server.PluginCreateInfo;

    return isPositionWithinNameOfVariable(
        info,
        fileName,
        content.indexOf("token") + 2,
    );
}
