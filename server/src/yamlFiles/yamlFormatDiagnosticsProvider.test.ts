import { BrunoFileType } from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { YamlFormatDiagnosticsProvider } from "./yamlFormatDiagnosticsProvider";

describe("YamlFormatDiagnosticsProvider for request files", () => {
    const provider = new YamlFormatDiagnosticsProvider();

    it("should not return diagnostics for a valid request file", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api/:id?a=1
  headers:
    - name: h1
      value: v
    - name: H1
      value: v2
      disabled: true
  params:
    - name: id
      value: "5"
      type: path
    - name: a
      value: "1"
      type: query
runtime:
  assertions:
    - expression: res.status
      operator: eq
      value: "200"
`);

        expect(diagnostics).toEqual([]);
    });

    it("should warn for duplicate headers, params, variables, scripts, assertions and actions", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api/:id?a=1
  headers:
    - name: h1
      value: v
    - name: h1
      value: v2
  params:
    - name: id
      value: "5"
      type: path
    - name: id
      value: "5"
      type: path
    - name: id
      value: "7"
      type: query
    - name: a
      value: "1"
      type: query
runtime:
  variables:
    - name: v1
      value: a
    - name: v1
      value: b
  scripts:
    - type: after-response
      code: a
    - type: after-response
      code: b
  assertions:
    - expression: res.status
      operator: eq
      value: "200"
    - expression: res.status
      operator: eq
      value: "200"
    - expression: res.status
      operator: neq
      value: "201"
  actions:
    - type: set-variable
      phase: after-response
      selector:
        expression: x
        method: jsonq
      variable:
        name: n
        scope: runtime
    - type: set-variable
      phase: after-response
      selector:
        expression: x
        method: jsonq
      variable:
        name: m
        scope: runtime
`);

        expect(diagnostics.map(({ message }) => message).sort()).toEqual([
            "Query params from URL '?a=1' do not match query params from 'params' '?id=7&a=1'",
            "Same combination of expression, operator, value already defined",
            "Same combination of type, name, value already defined",
            "Same combination of type, phase, selector expression, selector method already defined",
            "Same name already defined",
            "Same name already defined",
            "Same type already defined",
        ]);
        expect(diagnostics.every(({ severity }) => severity == 2)).toBe(true);
    });

    it("should not warn for repeated query params and assertions with different values", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /items?tag=a&tag=b
  params:
    - name: tag
      value: a
      type: query
    - name: tag
      value: b
      type: query
runtime:
  assertions:
    - expression: res.body.status
      operator: neq
      value: failed
    - expression: res.body.status
      operator: neq
      value: error
`);

        expect(diagnostics).toEqual([]);
    });

    it("should warn if path params and query params do not match the URL", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api/:id?a=1
  params:
    - name: other
      value: "5"
      type: path
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Path params missing in the URL: 'other'. Path params from the URL without a matching entry in 'params': 'id'",
            "Query params from URL '?a=1' do not match query params from 'params' ''",
        ]);
    });

    it("should warn if no response validation is defined", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api
runtime:
  scripts:
    - type: before-request
      code: a
`);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain("No 'assertions'");
    });

    it.each(["after-response", "tests"])(
        "should not warn about missing response validation if a '%s' script exists",
        (scriptType) => {
            const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api
runtime:
  scripts:
    - type: ${scriptType}
      code: a
`);

            expect(diagnostics).toEqual([]);
        },
    );

    it("should warn if the request type does not match the sections", () => {
        const diagnostics = getDiagnostics(`${infoSection}
graphql:
  url: /api
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Request type 'http' requires a 'http' section.",
            "Section 'graphql' does not match the request type 'http'.",
        ]);
        expect(diagnostics.every(({ severity }) => severity == 2)).toBe(true);
    });

    it("should warn for duplicate tags", () => {
        const diagnostics = getDiagnostics(
            validRequest({
                info: `${infoSection}
  tags:
    - a
    - b
    - a`,
            }),
        );

        expect(diagnostics.map(({ message }) => message)).toEqual([
            "Same tag already defined",
        ]);
    });

    it("should warn if the body type does not match the body data", () => {
        const noneWithData = getDiagnostics(
            validRequest({
                http: `  body:
    type: none
    data: abc`,
            }),
        );
        const jsonWithoutData = getDiagnostics(
            validRequest({
                http: `  body:
    type: json`,
            }),
        );

        expect(noneWithData.map(({ message }) => message)).toEqual([
            "A body is defined although the body type is 'none'.",
        ]);
        expect(jsonWithoutData.map(({ message }) => message)).toEqual([
            "No body data is defined for the body type 'json'.",
        ]);
    });

    it("should report invalid JSON body data, but ignore variables", () => {
        const invalid = getDiagnostics(
            validRequest({
                http: `  body:
    type: json
    data: '{"a": }'`,
            }),
        );
        const withVariable = getDiagnostics(
            validRequest({
                http: `  body:
    type: json
    data: '{"a": {{var}}}'`,
            }),
        );

        expect(invalid).toHaveLength(1);
        expect(invalid[0].severity).toBe(1);
        expect(withVariable).toEqual([]);
    });

    it("should only warn if keys are missing for the auth type", () => {
        const basic = getDiagnostics(
            validRequest({
                http: `  auth:
    type: basic
    username: user`,
            }),
        );
        const bearer = getDiagnostics(
            validRequest({
                http: `  auth:
    type: bearer`,
            }),
        );
        const inherit = getDiagnostics(
            validRequest({ http: "  auth: inherit" }),
        );

        expect(basic.map(({ message }) => message)).toEqual([
            "Missing keys for auth type 'basic': 'password'.",
        ]);
        expect(bearer.map(({ message }) => message)).toEqual([
            "Missing keys for auth type 'bearer': 'token'.",
        ]);
        expect(
            [...basic, ...bearer].every(({ severity }) => severity == 2),
        ).toBe(true);
        expect(inherit).toEqual([]);
    });

    it("should not report a missing request type section, if the section exists with an invalid value", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
`);

        expect(
            diagnostics.some(({ message }) =>
                String(message).includes("requires a"),
            ),
        ).toBe(false);
    });

    it("should point to the exact position of a JSON syntax error in a literal block scalar with an indentation indicator", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: POST
  url: /api
  body:
    type: json
    data: |2
        {"a": 1x}
`);

        const jsonDiagnostic = diagnostics.find(({ message }) =>
            String(message).startsWith("Invalid JSON request body"),
        );
        // The line is indented by 8 characters in the document, the error is at column 7 within the line.
        expect(jsonDiagnostic?.range.start.line).toBe(10);
        expect(jsonDiagnostic?.range.start.character).toBe(8 + 7);
    });

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/request.yml",
            content,
            BrunoFileType.RequestFile,
        );
    }
});

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

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/opencollection.yml",
            content,
            BrunoFileType.CollectionSettingsFile,
        );
    }
});

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

const header = `opencollection: 1.0.0
info:
  name: example`;

function validRequest(sections: { info?: string; http?: string }) {
    return `${sections.info ?? infoSection}
http:
  method: GET
  url: /api
${sections.http ?? ""}
runtime:
  assertions:
    - expression: res.status
      operator: eq
`;
}

const infoSection = `info:
  name: example
  type: http
  seq: 1`;
