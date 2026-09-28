import { describe, it, expect } from "@jest/globals";
import {
    BrunoFileType,
    EnvironmentFileTopLevelField,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { createCollectionWithEnvironments } from "@global_shared/_testingUtils";
import { CancellationToken, TextEdit } from "vscode-languageserver";
import { getCompletionsForPositionOutsideOfBlocks } from "./getCompletionsForPositionOutsideOfBlocks";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";

describe("getCompletionsForPositionOutsideOfBlocks", () => {
    describe("'extends' field value completions", () => {
        it("suggests other environments that do not create an inheritance loop", () => {
            const collection = createCollectionWithEnvironments([
                { name: "Base" },
                { name: "Staging", extends: "Base" },
                { name: "Dev" },
            ]);

            const completions = getExtendsValueCompletions(
                "/collection/environments/Dev.bru",
                collection,
            );

            expect(completions?.map(({ label }) => label).sort()).toEqual([
                "Base",
                "Staging",
            ]);
        });

        it("does not suggest the environment itself", () => {
            const collection = createCollectionWithEnvironments([
                { name: "Base" },
                { name: "Dev" },
            ]);

            const completions = getExtendsValueCompletions(
                "/collection/environments/Dev.bru",
                collection,
            );

            expect(completions?.map(({ label }) => label)).not.toContain("Dev");
        });

        it("does not suggest an environment that would directly create an inheritance loop", () => {
            const collection = createCollectionWithEnvironments([
                { name: "Base" },
                { name: "Loop", extends: "Dev" },
                { name: "Dev" },
            ]);

            const completions = getExtendsValueCompletions(
                "/collection/environments/Dev.bru",
                collection,
            );

            expect(completions?.map(({ label }) => label).sort()).toEqual([
                "Base",
            ]);
        });

        it("does not suggest an environment that would indirectly create an inheritance loop", () => {
            const collection = createCollectionWithEnvironments([
                { name: "Base" },
                { name: "Loop", extends: "Intermediate" },
                { name: "Intermediate", extends: "Dev" },
                { name: "Dev" },
            ]);

            const completions = getExtendsValueCompletions(
                "/collection/environments/Dev.bru",
                collection,
            );

            expect(completions?.map(({ label }) => label).sort()).toEqual([
                "Base",
            ]);
        });

        it("returns a text edit that replaces everything after the colon", () => {
            const collection = createCollectionWithEnvironments([
                { name: "Base" },
                { name: "Dev" },
            ]);

            const completions = getExtendsValueCompletions(
                "/collection/environments/Dev.bru",
                collection,
            );

            expect(completions).toHaveLength(1);
            expect(completions?.[0].textEdit).toEqual({
                newText: " Base",
                range: {
                    start: { line: 0, character: 8 },
                    end: { line: 0, character: 9 },
                },
            });
        });

        it("returns undefined when the position is not within the 'extends' field value", () => {
            const collection = createCollectionWithEnvironments([
                { name: "Base" },
                { name: "Dev" },
            ]);

            const result = getCompletionsForPositionOutsideOfBlocks(
                createBaseRequest(
                    "/collection/environments/Dev.bru",
                    "vars {\n}",
                    new Position(0, 0),
                ),
                BrunoFileType.EnvironmentFile,
                [],
                collection,
            );

            expect(
                result?.some(({ label }) => ["Base", "Dev"].includes(label)),
            ).toBe(false);
        });
    });

    it("suggests the 'extends' key itself when the document does not have one yet", () => {
        const collection = createCollectionWithEnvironments([{ name: "Dev" }]);

        const result = getCompletionsForPositionOutsideOfBlocks(
            createBaseRequest(
                "/collection/environments/Dev.bru",
                "",
                new Position(0, 0),
            ),
            BrunoFileType.EnvironmentFile,
            [],
            collection,
        );

        expect(
            result?.some(
                ({ label }) => label == EnvironmentFileTopLevelField.Extends,
            ),
        ).toBe(true);
    });

    it("lets the user choose from the available environments when suggesting the 'extends' key", () => {
        const collection = createCollectionWithEnvironments([
            { name: "Dev" },
            { name: "Staging" },
            { name: "Prod" },
        ]);

        const result = getCompletionsForPositionOutsideOfBlocks(
            createBaseRequest(
                "/collection/environments/Dev.bru",
                "",
                new Position(0, 0),
            ),
            BrunoFileType.EnvironmentFile,
            [],
            collection,
        );

        const extendsCompletion = result?.find(
            ({ label }) => label == EnvironmentFileTopLevelField.Extends,
        );

        expect(
            (extendsCompletion?.textEdit as TextEdit | undefined)?.newText,
        ).toBe(`${EnvironmentFileTopLevelField.Extends}: \${1|Staging,Prod|}`);
    });
});

function getExtendsValueCompletions(
    filePath: string,
    collection: TypedCollection,
) {
    return getCompletionsForPositionOutsideOfBlocks(
        createBaseRequest(filePath, "extends: ", new Position(0, 9)),
        BrunoFileType.EnvironmentFile,
        [],
        collection,
    );
}

function createBaseRequest(
    filePath: string,
    documentText: string,
    position: Position,
): LanguageFeatureBaseRequest {
    return {
        filePath,
        documentHelper: new TextDocumentHelper(documentText),
        position,
        token: CancellationToken.None,
    };
}
