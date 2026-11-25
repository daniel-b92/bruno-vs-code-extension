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
                }),
            ).toBeUndefined();
        });

        it("ignores the number of leading zeros", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "10_get-token.bru"),
                    content: getContent("10"),
                    fileType: BrunoFileType.RequestFile,
                }),
            ).toBeUndefined();
        });

        it("returns a warning on the sequence value for a different prefix", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "020_get-token.bru"),
                content: getContent("10"),
                fileType: BrunoFileType.RequestFile,
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
                targetPath: resolve(folder, "00010_get-token.bru"),
                isFile: true,
            } satisfies SequencePrefixDiagnosticData);
        });

        it("returns a warning if the name has no prefix", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "get-token.bru"),
                content: getContent("5"),
                fileType: BrunoFileType.AppFile,
            });

            expect(
                (diagnostic?.data as SequencePrefixDiagnosticData).targetPath,
            ).toBe(resolve(folder, "00005_get-token.bru"));
        });

        it.each(["abc", "1.5", "-1", "99999999999999999999"])(
            "returns no diagnostic for the invalid sequence '%s'",
            (sequence) => {
                expect(
                    getSequencePrefixDiagnostic({
                        filePath: resolve(folder, "get-token.bru"),
                        content: getContent(sequence),
                        fileType: BrunoFileType.RequestFile,
                    }),
                ).toBeUndefined();
            },
        );

        it.each([
            ["keeps digits that are part of", "404_a", "404_a", "00005_404_a"],
            ["removes digits that are not part of", "1000_a", "a", "00005_a"],
        ])("%s the stored name", (_, currentName, storedName, expectedName) => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, `${currentName}.bru`),
                content: `meta {\n  name: ${storedName}\n  type: http\n  seq: 5\n}\n`,
                fileType: BrunoFileType.RequestFile,
            });

            expect(
                (diagnostic?.data as SequencePrefixDiagnosticData).targetPath,
            ).toBe(resolve(folder, `${expectedName}.bru`));
        });

        it("checks the name of the folder for folder settings files", () => {
            const diagnostic = getSequencePrefixDiagnostic({
                filePath: resolve(folder, "folder.bru"),
                content: "meta {\n  name: users\n  seq: 3\n}\n",
                fileType: BrunoFileType.FolderSettingsFile,
            });

            expect(diagnostic?.data).toEqual({
                kind: "renameToMatchSequence",
                sourcePath: folder,
                targetPath: resolve("/collection", "00003_users"),
                isFile: false,
            } satisfies SequencePrefixDiagnosticData);
        });

        it("ignores other file types", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "collection.bru"),
                    content: getContent("1"),
                    fileType: BrunoFileType.CollectionSettingsFile,
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
            });

            expect(diagnostic?.range.start.line).toBe(3);
            expect(
                (diagnostic?.data as SequencePrefixDiagnosticData).targetPath,
            ).toBe(resolve(folder, "00007_get-token.yml"));
        });

        it("returns no diagnostic for a matching prefix", () => {
            expect(
                getSequencePrefixDiagnostic({
                    filePath: resolve(folder, "00007_get-token.yml"),
                    content: getContent(7),
                    fileType: BrunoFileType.RequestFile,
                }),
            ).toBeUndefined();
        });
    });
});
