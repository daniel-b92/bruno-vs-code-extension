import {
    createCollectionWithEnvironments,
    createItemProviderStub,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "../shared/interfaces";
import {
    BrunoFileType,
    CollectionDirectory,
    CollectionFormat,
} from "@global_shared";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for folder settings files", () => {
    const provider = new YamlFormatDiagnosticsProvider(
        createItemProviderStub<TypedCollectionItemProvider>(
            "/collection",
            CollectionFormat.Yaml,
        ),
    );

    it("should report another folder with the same parent and the same sequence", () => {
        const diagnostics = getDiagnosticsWithOtherFolders(
            [
                { name: "sibling", sequence: 2 },
                { name: "other", sequence: 3 },
            ],
            `${folderHeader}
  seq: 2`,
        );

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({
            message:
                "Other folders with the same sequence already exist for the same parent folder.",
            severity: DiagnosticSeverity.Error,
        });
    });

    it("should not report folders with other sequences", () => {
        const diagnostics = getDiagnosticsWithOtherFolders(
            [{ name: "sibling", sequence: 3 }],
            `${folderHeader}
  seq: 2`,
        );

        expect(diagnostics).toEqual([]);
    });

    it("should not report valid tags", () => {
        expect(
            getDiagnostics(`${folderHeader}
  tags:
    - a
    - b`),
        ).toEqual([]);
    });

    it("should report duplicate tags", () => {
        const diagnostics = getDiagnostics(`${folderHeader}
  tags:
    - a
    - a`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe("Same tag already defined");
    });

    it("should warn for duplicate headers even if no variables are defined", () => {
        const diagnostics = getDiagnostics(`${folderHeader}
request:
  headers:
    - name: h1
      value: a
    - name: h1
      value: b
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe("Same name already defined");
    });

    it("should warn for duplicate headers that only differ in casing", () => {
        const diagnostics = getDiagnostics(`${folderHeader}
request:
  headers:
    - name: Content-Type
      value: a
    - name: content-type
      value: b
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe("Same name already defined");
    });

    it("should warn if keys are missing for the auth type", () => {
        const diagnostics = getDiagnostics(`${folderHeader}
request:
  auth:
    type: basic
    username: u
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe(
            "Missing keys for auth type 'basic': 'password'.",
        );
    });

    it("should only hint at disabled items and not check them", () => {
        const diagnostics = getDiagnostics(`${folderHeader}
request:
  headers:
    - name: h1
      value: a
    - name: h1
      value: b
      disabled: true
  variables:
    - name: v1
      value: a
      disabled: true
`);

        expect(diagnostics.map(({ severity }) => severity)).toEqual([
            DiagnosticSeverity.Hint,
            DiagnosticSeverity.Hint,
        ]);
        expect(
            diagnostics.every(
                ({ tags }) => tags?.[0] == DiagnosticTag.Unnecessary,
            ),
        ).toBe(true);
    });

    function getDiagnosticsWithOtherFolders(
        others: { name: string; sequence: number }[],
        content: string,
    ) {
        const collection = createCollectionWithEnvironments(
            [],
            CollectionFormat.Yaml,
        );
        others.forEach(({ name, sequence }) =>
            collection.addItem({
                item: new CollectionDirectory(
                    `/collection/${name}`,
                    `/collection/${name}/folder.yml`,
                    sequence,
                ),
                additionalData: undefined,
            }),
        );

        return new YamlFormatDiagnosticsProvider(
            createItemProviderStub<TypedCollectionItemProvider>(
                "/collection",
                CollectionFormat.Yaml,
                collection,
            ),
        ).getDiagnosticsForYamlFile(
            "/collection/folder/folder.yml",
            content,
            BrunoFileType.FolderSettingsFile,
        );
    }

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/folder/folder.yml",
            content,
            BrunoFileType.FolderSettingsFile,
        );
    }
});

const folderHeader = `info:
  name: example
  type: folder`;
