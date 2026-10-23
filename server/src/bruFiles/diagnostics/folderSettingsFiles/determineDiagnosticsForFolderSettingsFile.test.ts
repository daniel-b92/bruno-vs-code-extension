import { describe, it, expect } from "@jest/globals";
import { CollectionFormat } from "@global_shared";
import { createItemProviderStub } from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "../../../shared";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { determineDiagnosticsForFolderSettingsFile } from "./determineDiagnosticsForFolderSettingsFile";

describe("determineDiagnosticsForFolderSettingsFile", () => {
    describe("tags in the meta block", () => {
        it("does not report valid tags", () => {
            expect(
                getDiagnostics(["tags: [", "    a", "    b", "  ]"]),
            ).toEqual([]);
        });

        it("reports duplicate tags", () => {
            const diagnostics = getDiagnostics([
                "tags: [",
                "    a",
                "    a",
                "  ]",
            ]);

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].code).toBe(
                RelevantWithinMetaBlockDiagnosticCode.DuplicateTagsDefined,
            );
        });

        it("reports tags that are not defined as an array", () => {
            const diagnostics = getDiagnostics(["tags: a"]);

            expect(diagnostics.length).toBeGreaterThan(0);
        });
    });
});

function getDiagnostics(additionalMetaLines: string[]) {
    const content = `meta {
  name: folder
  seq: 1
  ${additionalMetaLines.join("\n  ")}
}
`;

    return determineDiagnosticsForFolderSettingsFile(
        "/collection/folder/folder.bru",
        content,
        createItemProviderStub<TypedCollectionItemProvider>(
            "/collection",
            CollectionFormat.Bru,
        ),
        new RelatedFilesDiagnosticsHelper(),
    );
}
