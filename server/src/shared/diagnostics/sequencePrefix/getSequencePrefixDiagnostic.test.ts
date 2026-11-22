import { describe, it, expect } from "@jest/globals";
import { BrunoFileType } from "@global_shared";
import { resolve } from "path";
import { DiagnosticSeverity } from "vscode-languageserver";
import {
    getSequencePrefixDiagnostic,
    SequencePrefixDiagnosticData,
} from "./getSequencePrefixDiagnostic";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../bruFiles/diagnostics/shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

describe("getSequencePrefixDiagnostic", () => {
    const folder = resolve("/collection/users");

    describe("for Bru files", () => {
        const getContent = (seq: string) =>
            `meta {\n  name: get-token\n  type: http\n  seq: ${seq}\n}\n`;

        it("returns no diagnostic if the prefix matches the sequence", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "010_get-token.bru"),
                    content: getContent("10"),
                    fileType: BrunoFileType.RequestFile,
                    sequenceStep: 10,
                }),
            ).toBeUndefined();
        });

        it("ignores the number of leading zeros", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "10_get-token.bru"),
                    content: getContent("10"),
                    fileType: BrunoFileType.RequestFile,
                    sequenceStep: 10,
                }),
            ).toBeUndefined();
        });

        it("returns a warning on the sequence value for a different prefix", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "020_get-token.bru"),
                content: getContent("10"),
                fileType: BrunoFileType.RequestFile,
                sequenceStep: 10,
            });

            expect(diagnostic?.severity).toBe(DiagnosticSeverity.Warning);
            expect(diagnostic?.code).toBe(
                RelevantWithinMetaBlockDiagnosticCode.SequenceNotMatchingItemName,
            );
            expect(diagnostic?.range).toEqual({
                start: { line: 3, character: 7 },
                end: { line: 3, character: 9 },
            });
            expect(diagnostic?.data).toEqual({
                kind: "renameToMatchSequence",
                sourcePath: resolve(folder, "020_get-token.bru"),
                targetPath: resolve(folder, "0010_get-token.bru"),
                isFile: true,
            } satisfies SequencePrefixDiagnosticData);
        });

        it("returns a warning if the name has no prefix", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "get-token.bru"),
                content: getContent("5"),
                fileType: BrunoFileType.AppFile,
                sequenceStep: 1,
            });

            expect(
                (diagnostic?.data as SequencePrefixDiagnosticData).targetPath,
            ).toBe(resolve(folder, "005_get-token.bru"));
        });

        it("returns no diagnostic if the sequence is invalid", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "get-token.bru"),
                    content: getContent("abc"),
                    fileType: BrunoFileType.RequestFile,
                    sequenceStep: 1,
                }),
            ).toBeUndefined();
        });

        it("checks the name of the folder for folder settings files", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "folder.bru"),
                content: "meta {\n  name: users\n  seq: 3\n}\n",
                fileType: BrunoFileType.FolderSettingsFile,
                sequenceStep: 1,
            });

            expect(diagnostic?.data).toEqual({
                kind: "renameToMatchSequence",
                sourcePath: folder,
                targetPath: resolve("/collection", "003_users"),
                isFile: false,
            } satisfies SequencePrefixDiagnosticData);
        });

        it("ignores other file types", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "collection.bru"),
                    content: getContent("1"),
                    fileType: BrunoFileType.CollectionSettingsFile,
                    sequenceStep: 1,
                }),
            ).toBeUndefined();
        });
    });

    describe("for Yaml files", () => {
        const getContent = (seq: number) =>
            [
                "info:",
                "  name: get-token",
                "  type: http",
                `  seq: ${seq}`,
                "http:",
                "  method: GET",
                "  url: http://localhost",
                "",
            ].join("\n");

        it("returns a warning on the sequence value for a different prefix", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "get-token.yml"),
                content: getContent(7),
                fileType: BrunoFileType.RequestFile,
                sequenceStep: 1,
            });

            expect(diagnostic?.range.start.line).toBe(3);
            expect(
                (diagnostic?.data as SequencePrefixDiagnosticData).targetPath,
            ).toBe(resolve(folder, "007_get-token.yml"));
        });

        it("returns no diagnostic for a matching prefix", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "007_get-token.yml"),
                    content: getContent(7),
                    fileType: BrunoFileType.RequestFile,
                    sequenceStep: 1,
                }),
            ).toBeUndefined();
        });
    });
});
