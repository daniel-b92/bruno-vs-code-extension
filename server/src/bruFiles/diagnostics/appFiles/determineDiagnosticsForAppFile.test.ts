import { describe, it, expect } from "@jest/globals";
import {
    BrunoAppFile,
    BrunoRequestFile,
    CollectionFormat,
} from "@global_shared";
import {
    createCollectionWithEnvironments,
    createItemProviderStub,
} from "@global_shared/_testingUtils";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../../shared";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { determineDiagnosticsForAppFile } from "./determineDiagnosticsForAppFile";

describe("determineDiagnosticsForAppFile", () => {
    it.each([
        ["an app file", new BrunoAppFile("/collection/other.bru", 1)],
        ["a request file", new BrunoRequestFile("/collection/other.bru", 1)],
    ])(
        "warns if %s in the same folder has the same sequence",
        (_, otherItem) => {
            const diagnostics = getDiagnostics(otherItem);

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0]).toMatchObject({
                code: RelevantWithinMetaBlockDiagnosticCode.SequenceClashesWithAppFileInFolder,
                severity: DiagnosticSeverity.Warning,
            });
        },
    );

    it("does not warn if the other file in the folder has another sequence", () => {
        expect(
            getDiagnostics(new BrunoAppFile("/collection/other.bru", 2)),
        ).toEqual([]);
    });
});

function getDiagnostics(otherItem: BrunoAppFile | BrunoRequestFile) {
    const collection = createCollectionWithEnvironments(
        [],
        CollectionFormat.Bru,
    );
    collection.addItem({ item: otherItem, additionalData: undefined });

    return determineDiagnosticsForAppFile(
        "/collection/app.bru",
        `meta {
  name: app
  type: app
  seq: 1
}

app {
  code: foo
}
`,
        createItemProviderStub<TypedCollectionItemProvider>(
            "/collection",
            CollectionFormat.Bru,
            collection,
        ),
    );
}
