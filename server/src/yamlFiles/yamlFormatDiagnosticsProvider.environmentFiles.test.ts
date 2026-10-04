import { BrunoFileType } from "@global_shared";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for environment files", () => {
    const provider = new YamlFormatDiagnosticsProvider();

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

    it("should report a missing name even if no variables are defined", () => {
        const diagnostics = getDiagnostics(`color: red
`);

        expect(diagnostics.map(({ message }) => message)).toContain(
            "Mandatory top-level key 'name' missing.",
        );
    });

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/environments/env.yml",
            content,
            BrunoFileType.EnvironmentFile,
        );
    }
});
