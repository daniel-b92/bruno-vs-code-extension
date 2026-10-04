import { BrunoFileType } from "@global_shared";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for app files", () => {
    const provider = new YamlFormatDiagnosticsProvider();

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

    it("should report a missing info section", () => {
        const diagnostics = getDiagnostics("code: foo");

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain("info");
    });

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/app.yml",
            content,
            BrunoFileType.AppFile,
        );
    }
});
