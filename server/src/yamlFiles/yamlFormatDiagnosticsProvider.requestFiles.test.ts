import { BrunoFileType } from "@global_shared";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
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
    - name: H2
      value: v2
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
            String(message).startsWith("Invalid JSON"),
        );
        // The line is indented by 8 characters in the document, the error is at column 7 within the line.
        expect(jsonDiagnostic?.range.start.line).toBe(10);
        expect(jsonDiagnostic?.range.start.character).toBe(8 + 7);
    });

    it("should only hint at disabled items and not check them", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api
  headers:
    - name: h1
      value: a
    - name: H1
      value: b
      disabled: true
  params:
    - name: q
      value: "1"
      type: query
      disabled: true
runtime:
  variables:
    - name: v1
      value: a
      disabled: true
  actions:
    - type: set-variable
      phase: after-response
      selector:
        expression: x
        method: jsonq
      variable:
        name: n
        scope: runtime
      disabled: true
  assertions:
    - expression: res.status
      operator: eq
      value: "200"
    - expression: res.status
      operator: eq
      value: "200"
      disabled: true
`);

        expect(diagnostics).toHaveLength(5);
        expect(
            diagnostics.every(
                ({ severity, tags }) =>
                    severity == DiagnosticSeverity.Hint &&
                    tags?.[0] == DiagnosticTag.Unnecessary,
            ),
        ).toBe(true);
    });

    it("should warn that no response validation exists if all assertions are disabled", () => {
        const diagnostics = getDiagnostics(`${infoSection}
http:
  method: GET
  url: /api
runtime:
  assertions:
    - expression: res.status
      operator: eq
      value: "200"
      disabled: true
`);

        expect(
            diagnostics.filter(
                ({ severity }) => severity == DiagnosticSeverity.Warning,
            ),
        ).toHaveLength(1);
    });

    describe("graphql requests", () => {
        it("should report duplicate headers, invalid variables JSON and disabled items", () => {
            const diagnostics = getDiagnostics(`info:
  name: example
  type: graphql
  seq: 1
graphql:
  method: POST
  url: /graphql
  headers:
    - name: a
      value: "1"
    - name: a
      value: "2"
    - name: b
      value: "3"
      disabled: true
  body:
    query: "query { a }"
    variables: |-
      {"a": }
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

            expect(diagnostics.map(({ message }) => message)).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("Same name already defined"),
                    expect.stringContaining("JSON"),
                ]),
            );
            expect(
                diagnostics.filter(
                    ({ severity, tags }) =>
                        severity == DiagnosticSeverity.Hint &&
                        tags?.[0] == DiagnosticTag.Unnecessary,
                ),
            ).toHaveLength(1);
        });

        it.each(['""', "|-\n      "])(
            "should not report empty variables (%j)",
            (variables) => {
                const diagnostics = getDiagnostics(`info:
  name: example
  type: graphql
  seq: 1
graphql:
  url: /graphql
  body:
    query: "query { a }"
    variables: ${variables}
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

                expect(
                    diagnostics.filter(({ message }) =>
                        String(message).startsWith("Invalid JSON"),
                    ),
                ).toHaveLength(0);
            },
        );

        it("should report missing auth keys", () => {
            const diagnostics = getDiagnostics(`info:
  name: example
  type: graphql
  seq: 1
graphql:
  url: /graphql
  auth:
    type: bearer
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

            expect(diagnostics.map(({ message }) => message)).toContain(
                "Missing keys for auth type 'bearer': 'token'.",
            );
        });
    });

    describe("websocket requests", () => {
        it("should report duplicate headers, invalid JSON messages and disabled items", () => {
            const diagnostics = getDiagnostics(`info:
  name: example
  type: websocket
  seq: 1
websocket:
  url: ws://example.com
  headers:
    - name: a
      value: "1"
    - name: a
      value: "2"
    - name: b
      value: "3"
      disabled: true
  message:
    - title: invalid
      message:
        type: json
        data: |-
          {"a": }
    - title: valid
      message:
        type: json
        data: '{"a": 1}'
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

            expect(diagnostics.map(({ message }) => message)).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("Same name already defined"),
                    expect.stringContaining("JSON"),
                ]),
            );
            expect(
                diagnostics.filter(({ message }) =>
                    String(message).startsWith("Invalid JSON"),
                ),
            ).toHaveLength(1);
            expect(
                diagnostics.filter(
                    ({ severity, tags }) =>
                        severity == DiagnosticSeverity.Hint &&
                        tags?.[0] == DiagnosticTag.Unnecessary,
                ),
            ).toHaveLength(1);
        });

        it("should report invalid JSON for a single message defined as a map", () => {
            const diagnostics = getDiagnostics(`info:
  name: example
  type: websocket
  seq: 1
websocket:
  url: ws://example.com
  message:
    type: json
    data: '{"a": }'
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

            expect(
                diagnostics.filter(({ message }) =>
                    String(message).startsWith("Invalid JSON"),
                ),
            ).toHaveLength(1);
        });

        it("should report a message type without data", () => {
            const diagnostics = getDiagnostics(`info:
  name: example
  type: websocket
  seq: 1
websocket:
  url: ws://example.com
  message:
    - message:
        type: text
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

            expect(diagnostics.map(({ message }) => message)).toContain(
                "No message data is defined for the message type 'text'.",
            );
        });

        it("should report missing auth keys", () => {
            const diagnostics = getDiagnostics(`info:
  name: example
  type: websocket
  seq: 1
websocket:
  url: ws://example.com
  auth:
    type: bearer
runtime:
  assertions:
    - expression: res.status
      operator: eq
`);

            expect(diagnostics.map(({ message }) => message)).toContain(
                "Missing keys for auth type 'bearer': 'token'.",
            );
        });
    });

    function getDiagnostics(content: string) {
        return provider.getDiagnosticsForYamlFile(
            "/collection/request.yml",
            content,
            BrunoFileType.RequestFile,
        );
    }
});

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
