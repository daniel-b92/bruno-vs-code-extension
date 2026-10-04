import { BrunoFileType } from "@global_shared";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for folder settings files", () => {
    const provider = new YamlFormatDiagnosticsProvider();

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
