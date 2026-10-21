import { describe, expect, it } from "@jest/globals";
import {
    BrunoFileType,
    BrunoVariableType,
    TextDocumentHelper,
    VariableAvailabilityScopes,
    VariableReferenceType,
    VariableScopeSection,
    VariableScopeSectionKind,
} from "../../..";
import { getVariableScopeSectionsFromYamlFile } from "./getVariableScopeSectionsFromYamlFile";

describe("getVariableScopeSectionsFromYamlFile", () => {
    it("creates sections with the matching kinds for a request file", () => {
        const sections = getSections(
            BrunoFileType.RequestFile,
            `info:
  name: test
http:
  method: GET
  url: "{{baseUrl}}/path"
runtime:
  variables:
    - name: first
      value: "1"
  actions:
    - type: set-variable
      phase: after-response
      variable:
        name: second
  assertions:
    - expression: res.body
      operator: eq
      value: "{{expected}}"
docs: |
  {{notAReference}}
`,
        );

        expect(sections.map(({ name, kind }) => ({ name, kind }))).toEqual([
            { name: "info", kind: VariableScopeSectionKind.NoVariableSupport },
            { name: "http", kind: VariableScopeSectionKind.Request },
            {
                name: "runtime.variables",
                kind: VariableScopeSectionKind.PreRequestVars,
            },
            {
                name: "runtime.actions",
                kind: VariableScopeSectionKind.PostResponseVars,
            },
            {
                name: "runtime.assertions",
                kind: VariableScopeSectionKind.Assertions,
            },
            { name: "docs", kind: VariableScopeSectionKind.NoVariableSupport },
        ]);
    });

    it("finds read references in single-line scalars", () => {
        const sections = getSections(
            BrunoFileType.RequestFile,
            `http:
  method: GET
  url: "{{baseUrl}}/path"
  headers:
    - name: a
      value: plain-{{token}}
`,
        );

        const references = findSection(sections, "http").variableReferences;

        expect(references.map((r) => r.variableName)).toEqual([
            "baseUrl",
            "token",
        ]);
        expect(references[0]).toMatchObject({
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Unknown,
        });
        expect(references[0].variableNameRange.start).toMatchObject({
            line: 2,
            character: 10,
        });
        expect(references[1].variableNameRange.start).toMatchObject({
            line: 5,
            character: 21,
        });
    });

    it("finds read references in block scalars", () => {
        const sections = getSections(
            BrunoFileType.RequestFile,
            `http:
  method: POST
  url: http://localhost
  body:
    type: json
    data: |
      {"a": "{{value}}"}
`,
        );

        const references = findSection(sections, "http").variableReferences;

        expect(references.map((r) => r.variableName)).toEqual(["value"]);
        expect(references[0].variableNameRange.start).toMatchObject({
            line: 6,
            character: 15,
        });
    });

    it("finds write references for variables and actions that set variables", () => {
        const sections = getSections(
            BrunoFileType.RequestFile,
            `runtime:
  variables:
    - name: first
      value: "{{ignored}}"
    - name: disabledVar
      value: x
      disabled: true
  actions:
    - type: set-variable
      phase: after-response
      selector:
        expression: res.body.id
        method: jsonq
      variable:
        name: second
        scope: runtime
`,
        );

        expect(
            findSection(sections, "runtime.variables").variableReferences,
        ).toEqual([
            expect.objectContaining({
                variableName: "first",
                referenceType: VariableReferenceType.Write,
                variableType: BrunoVariableType.Request,
                scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
            }),
        ]);
        expect(
            findSection(sections, "runtime.actions").variableReferences,
        ).toEqual([
            expect.objectContaining({
                variableName: "second",
                referenceType: VariableReferenceType.Write,
                variableType: BrunoVariableType.Request,
                scope: VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
            }),
        ]);
    });

    it("creates sections for scripts defined as literal block scalars", () => {
        const sections = getSections(
            BrunoFileType.RequestFile,
            `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("a", 1);
    - type: after-response
      code: |
        bru.getVar("a");
    - type: tests
      code: |
        bru.getEnvVar("b");
`,
        );

        expect(
            sections.map(({ kind, variableReferences }) => ({
                kind,
                variables: variableReferences.map((r) => r.variableName),
            })),
        ).toEqual([
            {
                kind: VariableScopeSectionKind.PreRequestScript,
                variables: ["a"],
            },
            {
                kind: VariableScopeSectionKind.PostResponseScript,
                variables: ["a"],
            },
            { kind: VariableScopeSectionKind.Tests, variables: ["b"] },
        ]);
    });

    it("uses the folder variable type for settings files", () => {
        const sections = getSections(
            BrunoFileType.FolderSettingsFile,
            `info:
  name: folder
  type: folder
request:
  headers:
    - name: h
      value: "{{headerValue}}"
  variables:
    - name: folderVar
      value: x
`,
        );

        expect(sections.map(({ name }) => name)).toEqual([
            "info",
            "request.headers",
            "request.variables",
        ]);
        expect(
            findSection(sections, "request.headers").variableReferences.map(
                (r) => r.variableName,
            ),
        ).toEqual(["headerValue"]);
        expect(
            findSection(sections, "request.variables").variableReferences[0]
                .variableType,
        ).toBe(BrunoVariableType.Folder);
    });

    it("tolerates syntax errors in other parts of the document", () => {
        const sections = getSections(
            BrunoFileType.RequestFile,
            `http:
  url: "{{baseUrl}}"
  method: [
`,
        );

        expect(sections.length).toBeGreaterThan(0);
    });

    it("returns no sections for unsupported file types", () => {
        expect(
            getSections(BrunoFileType.EnvironmentFile, "name: test\n"),
        ).toEqual([]);
    });
});

function getSections(fileType: BrunoFileType, content: string) {
    return getVariableScopeSectionsFromYamlFile(
        new TextDocumentHelper(content),
        fileType,
    );
}

function findSection(sections: VariableScopeSection[], name: string) {
    const section = sections.find((s) => s.name == name);
    if (!section) {
        throw new Error(`Section '${name}' not found.`);
    }
    return section;
}
