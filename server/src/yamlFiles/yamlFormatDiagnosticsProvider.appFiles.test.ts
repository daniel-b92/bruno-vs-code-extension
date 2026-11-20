import {
    createCollectionWithEnvironments,
    createItemProviderStub,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "../shared/interfaces";
import {
    BrunoAppFile,
    BrunoFileType,
    BrunoRequestFile,
    CollectionFormat,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for app files", () => {
    const provider = new YamlFormatDiagnosticsProvider(
        createItemProviderStub<TypedCollectionItemProvider>(
            "/collection",
            CollectionFormat.Yaml,
        ),
    );

    it("should not return diagnostics for a valid app file", () => {
        expect(
            getDiagnostics(`info:
  name: app
  type: app
  seq: 1
code: |
  foo
`),
        ).toHaveLength(0);
    });

    it("should report an invalid type", () => {
        const diagnostics = getDiagnostics(`info:
  name: app
  type: http
code: foo
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain("Invalid value 'http'");
        expect(diagnostics[0].range).toEqual({
            start: { line: 2, character: 8 },
            end: { line: 2, character: 12 },
        });
    });

    it("should hint that the syntax highlighting is limited if the file does not start with the info section", () => {
        const diagnostics = getDiagnostics(`# comment
info:
  name: app
  type: app
code: foo
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Information);
        expect(diagnostics[0].range.start.line).toBe(1);
    });

    it("should report a missing info section", () => {
        const diagnostics = getDiagnostics("code: foo");

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain("info");
    });

    it.each([
        ["an app file", new BrunoAppFile("/collection/other.yml", 1)],
        ["a request file", new BrunoRequestFile("/collection/other.yml", 1)],
    ])(
        "should warn if %s in the same folder has the same sequence",
        (_, otherItem) => {
            const diagnostics = getDiagnosticsWithOtherItem(otherItem);

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0]).toMatchObject({
                severity: DiagnosticSeverity.Warning,
                range: { start: { line: 3 }, end: { line: 3 } },
            });
        },
    );

    it("should not warn if the other file in the folder has another sequence", () => {
        expect(
            getDiagnosticsWithOtherItem(
                new BrunoAppFile("/collection/other.yml", 2),
            ),
        ).toEqual([]);
    });

    function getDiagnosticsWithOtherItem(
        otherItem: BrunoAppFile | BrunoRequestFile,
    ) {
        const collection = createCollectionWithEnvironments(
            [],
            CollectionFormat.Yaml,
        );
        collection.addItem({ item: otherItem, additionalData: undefined });

        return new YamlFormatDiagnosticsProvider(
            createItemProviderStub<TypedCollectionItemProvider>(
                "/collection",
                CollectionFormat.Yaml,
                collection,
            ),
        ).getDiagnosticsForYamlFile(
            "/collection/app.yml",
            `info:
  name: app
  type: app
  seq: 1
code: |
  foo
`,
            BrunoFileType.AppFile,
        );
    }

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/app.yml",
            content,
            BrunoFileType.AppFile,
        );
    }
});
