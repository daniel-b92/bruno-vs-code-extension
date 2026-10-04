import { BrunoFileType } from "@global_shared";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for collection settings files", () => {
    const provider = new YamlFormatDiagnosticsProvider();

    it("should not return diagnostics for a valid collection settings file", () => {
        const diagnostics = getDiagnostics(`${header}
config:
  clientCertificates:
    - domain: a.com
      type: pem
      certificateFilePath: c.pem
      privateKeyFilePath: k.pem
    - domain: b.com
      type: pkcs12
      pfxFilePath: c.pfx
request:
  headers:
    - name: h1
      value: v
`);

        expect(diagnostics).toEqual([]);
    });

    it("should report missing and disallowed keys for the client certificate type", () => {
        const diagnostics = getDiagnostics(`${header}
config:
  clientCertificates:
    - domain: a.com
      type: pem
      certificateFilePath: c.pem
      pfxFilePath: c.pfx
    - domain: b.com
      type: pkcs12
      privateKeyFilePath: k.pem
`);

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Missing keys for client certificate type 'pem': 'privateKeyFilePath'.",
            "Key 'pfxFilePath' is not allowed for client certificate type 'pem'.",
            "Missing keys for client certificate type 'pkcs12': 'pfxFilePath'.",
            "Key 'privateKeyFilePath' is not allowed for client certificate type 'pkcs12'.",
        ]);
        expect(diagnostics.map(({ severity }) => severity)).toEqual([
            DiagnosticSeverity.Error,
            DiagnosticSeverity.Warning,
            DiagnosticSeverity.Error,
            DiagnosticSeverity.Warning,
        ]);
    });

    it("should warn for duplicate headers in the request section", () => {
        const diagnostics = getDiagnostics(`${header}
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

    it("should warn if keys are missing for the auth type in the request section", () => {
        const diagnostics = getDiagnostics(`${header}
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

    it("should report an error if auth is inherited", () => {
        const diagnostics = getDiagnostics(`${header}
request:
  auth: inherit
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
        expect(diagnostics[0].message).toContain("cannot be inherited");
    });

    it("should only hint at a disabled proxy, not additionally at its auth", () => {
        const diagnostics = getDiagnostics(`${header}
config:
  proxy:
    disabled: true
    config:
      hostname: localhost
      auth:
        username: u
        disabled: true
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Hint);
        expect(diagnostics[0].range.start.line).toBe(5);
    });

    it("should hint at disabled proxy auth", () => {
        const diagnostics = getDiagnostics(`${header}
config:
  proxy:
    config:
      hostname: localhost
      auth:
        username: u
        disabled: true
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Hint);
        expect(diagnostics[0].tags).toEqual([DiagnosticTag.Unnecessary]);
        expect(diagnostics[0].range.start.line).toBe(8);
    });

    it("should only hint at disabled client certificates and not check them", () => {
        const diagnostics = getDiagnostics(`${header}
config:
  clientCertificates:
    - domain: a.com
      type: pem
      certificateFilePath: c.pem
      disabled: true
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Hint);
        expect(diagnostics[0].tags).toEqual([DiagnosticTag.Unnecessary]);
    });

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/opencollection.yml",
            content,
            BrunoFileType.CollectionSettingsFile,
        );
    }
});

const header = `opencollection: 1.0.0
info:
  name: example`;
