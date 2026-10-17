import { NonBrunoSpecificItemType } from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for unrecognized files", () => {
    const provider = new YamlFormatDiagnosticsProvider();

    it("should only hint that the file is not recognized if there is no info type", () => {
        const diagnostics = getDiagnostics(`info:
  name: foo
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Hint);
        expect(diagnostics[0].message).toContain("not recognized");
    });

    it("should hint that the file is not recognized for non-Bruno yaml files", () => {
        const diagnostics = getDiagnostics(`services:
  web:
    image: nginx
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Hint);
    });

    it("should report an unsupported info type on the value", () => {
        const diagnostics = getDiagnostics(`info:
  name: foo
  type: htp
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Information);
        expect(diagnostics[0].message).toContain(
            "Unsupported 'info.type' 'htp'",
        );
        expect(diagnostics[0].range).toEqual({
            start: { line: 2, character: 8 },
            end: { line: 2, character: 11 },
        });
    });

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/foo.yml",
            content,
            NonBrunoSpecificItemType.OtherFileType,
        );
    }
});
