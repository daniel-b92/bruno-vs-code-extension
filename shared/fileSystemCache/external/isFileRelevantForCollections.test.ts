import { describe, it, expect } from "@jest/globals";
import { isFileRelevantForCollections } from "./isFileRelevantForCollections";

describe("isFileRelevantForCollections", () => {
    const workspaceFolders = ["/workspace"];

    it.each([
        ["bru file in workspace", "/workspace/collection/request.bru", true],
        ["bru file outside of workspace", "/other/request.bru", false],
        ["js file in workspace", "/workspace/collection/script.js", true],
        ["js file outside of workspace", "/other/script.js", true],
        ["js file in node_modules", "/workspace/node_modules/lib/a.js", false],
        ["other file in workspace", "/workspace/readme.md", false],
        ["yml file in workspace", "/workspace/collection/request.yml", false],
    ])("%s", (_, filePath, expected) => {
        expect(
            isFileRelevantForCollections(filePath, workspaceFolders, {
                yamlCollectionSupport: false,
            }),
        ).toBe(expected);
    });

    it("treats yml files in the workspace as relevant if the yaml feature toggle is enabled", () => {
        expect(
            isFileRelevantForCollections(
                "/workspace/collection/request.yml",
                workspaceFolders,
                { yamlCollectionSupport: true },
            ),
        ).toBe(true);
    });

    it("does not treat folders with a common name prefix as workspace folders", () => {
        expect(
            isFileRelevantForCollections(
                "/workspace-other/request.bru",
                workspaceFolders,
                { yamlCollectionSupport: false },
            ),
        ).toBe(false);
    });
});
