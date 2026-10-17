import {
    createCollectionWithEnvironments,
    createItemProviderStub,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "../shared/interfaces";
import { BrunoFileType, CollectionFormat } from "@global_shared";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for environment files", () => {
    const provider = new YamlFormatDiagnosticsProvider(
        createItemProviderStub<TypedCollectionItemProvider>(
            "/collection",
            CollectionFormat.Yaml,
        ),
    );

    it("should only hint at disabled variables and not check them", () => {
        const diagnostics = getDiagnostics(`name: env
variables:
  - name: a
    value: "1"
  - name: a
    value: "2"
    disabled: true
  - name: b
    secret: true
    value: redundant
    disabled: true
`);

        expect(diagnostics).toHaveLength(2);
        expect(
            diagnostics.every(
                ({ severity, tags }) =>
                    severity == DiagnosticSeverity.Hint &&
                    tags?.[0] == DiagnosticTag.Unnecessary,
            ),
        ).toBe(true);
    });

    it("should report an extended environment that does not exist", () => {
        const diagnostics = getDiagnostics(`name: env
extends: Unknown
variables: []
`);

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Environment 'Unknown' referenced by 'extends' does not exist in this collection.",
        ]);
    });

    it("should report an environment extending itself", () => {
        const diagnostics = getDiagnostics(`name: env
extends: env
variables: []
`);

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Environment 'env' cannot extend itself.",
        ]);
    });

    it("should report an extends field that creates an inheritance loop", () => {
        const diagnostics = getDiagnostics(
            `name: env
extends: Base
variables: []
`,
            createItemProviderStub<TypedCollectionItemProvider>(
                "/collection",
                CollectionFormat.Yaml,
                createCollectionWithEnvironments(
                    [{ name: "Base", extends: "env" }, { name: "env" }],
                    CollectionFormat.Yaml,
                ),
            ),
        );

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain("endless loop");
    });

    it("should not report a valid extends field", () => {
        const diagnostics = getDiagnostics(
            `name: env
extends: Base
variables: []
`,
            createItemProviderStub<TypedCollectionItemProvider>(
                "/collection",
                CollectionFormat.Yaml,
                createCollectionWithEnvironments(
                    [{ name: "Base" }, { name: "env" }],
                    CollectionFormat.Yaml,
                ),
            ),
        );

        expect(diagnostics).toEqual([]);
    });

    it("should report a missing name even if no variables are defined", () => {
        const diagnostics = getDiagnostics(`variables: []
`);

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Mandatory key 'name' missing in Yaml map.",
        ]);
    });

    function getDiagnostics(
        content: string,
        otherItemProvider?: TypedCollectionItemProvider,
    ) {
        return (
            otherItemProvider
                ? new YamlFormatDiagnosticsProvider(otherItemProvider)
                : provider
        ).getDiagnosticsForYamlFile(
            "/collection/environments/env.yml",
            content,
            BrunoFileType.EnvironmentFile,
        );
    }
});
