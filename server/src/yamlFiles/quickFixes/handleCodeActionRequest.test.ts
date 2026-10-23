import { describe, it, expect } from "@jest/globals";
import { applyTextEdits } from "@global_shared/_testingUtils";
import { CodeAction, Diagnostic } from "vscode-languageserver";
import { handleCodeActionRequest } from "./handleCodeActionRequest";
import { YamlDiagnosticCode } from "../diagnostics/yamlDiagnosticCodeEnum";

const uri = "file:///collection/request.yml";

describe("handleCodeActionRequest", () => {
    describe("query params", () => {
        it("offers both directions if the URL does not match 'params'", () => {
            const content = getRequestFile("/api?a=1&b=2", [
                "- name: a",
                '  value: "1"',
                "  type: query",
                "- name: c",
                '  value: "3"',
                "  type: query",
            ]);

            const actions = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingQueryParams,
            );

            expect(actions.map(({ title }) => title)).toEqual([
                "Update URL to match query params in 'params'",
                "Update query params in 'params' to match URL",
            ]);
            expect(applyAction(content, actions[0])).toEqual(
                content.replace("/api?a=1&b=2", "/api?a=1&c=3"),
            );
            expect(applyAction(content, actions[1])).toEqual(
                getRequestFile("/api?a=1&b=2", [
                    "- name: a",
                    '  value: "1"',
                    "  type: query",
                    "- name: b",
                    '  value: "2"',
                    "  type: query",
                ]),
            );
        });

        it("removes the 'params' key if the URL has no query params", () => {
            const content = getRequestFile("/api", [
                "- name: a",
                '  value: "1"',
                "  type: query",
            ]);

            const [, updateParams] = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingQueryParams,
            );

            expect(applyAction(content, updateParams)).toEqual(
                getRequestFile("/api", []),
            );
        });

        it("links the diagnostic to the fix", () => {
            const content = getRequestFile("/api?a=1", []);
            const diagnostic = getDiagnostic(
                YamlDiagnosticCode.UrlNotMatchingQueryParams,
            );

            const actions = handleCodeActionRequest({
                uri,
                fileContent: content,
                diagnostics: [diagnostic],
            });

            expect(actions.length).toBe(2);
            actions.forEach((action) =>
                expect(action.diagnostics).toEqual([diagnostic]),
            );
        });

        it("does not offer to update 'params' if it is a flow sequence", () => {
            const content = getRequestFile("/api?a=1", []).concat(
                "  params: []\n",
            );

            expect(
                getActions(
                    content,
                    YamlDiagnosticCode.UrlNotMatchingQueryParams,
                ).map(({ title }) => title),
            ).toEqual(["Update URL to match query params in 'params'"]);
        });
    });

    describe("path params", () => {
        it("adds the missing path params", () => {
            const content = getRequestFile("/api/:id", []);

            const actions = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingPathParams,
            );

            expect(actions.map(({ title }) => title)).toEqual([
                "Update path params in 'params' to match URL",
            ]);
            expect(applyAction(content, actions[0])).toEqual(
                getRequestFile("/api/:id", [
                    "- name: id",
                    '  value: ""',
                    "  type: path",
                ]),
            );
        });

        it("removes path params that are not part of the URL", () => {
            const content = getRequestFile("/api", [
                "- name: id",
                '  value: ""',
                "  type: path",
            ]);

            const [action] = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingPathParams,
            );

            expect(applyAction(content, action)).toEqual(
                getRequestFile("/api", []),
            );
        });
    });

    it("offers no fixes for other diagnostic codes", () => {
        expect(getActions(getRequestFile("/api?a=1", []), "bru14")).toEqual([]);
    });

    it("offers no fixes for diagnostics without a code", () => {
        expect(getActions(getRequestFile("/api?a=1", []), undefined)).toEqual(
            [],
        );
    });
});

function getRequestFile(url: string, paramLines: string[]) {
    return [
        "info:",
        "  name: request",
        "  type: http",
        "  seq: 1",
        "",
        "http:",
        "  method: GET",
        `  url: ${url}`,
        ...(paramLines.length > 0
            ? ["  params:", ...paramLines.map((line) => `    ${line}`)]
            : []),
        "",
    ].join("\n");
}

function getDiagnostic(code: Diagnostic["code"]): Diagnostic {
    return {
        message: "",
        code,
        range: {
            start: { line: 7, character: 7 },
            end: { line: 7, character: 8 },
        },
    };
}

function getActions(fileContent: string, code: Diagnostic["code"]) {
    return handleCodeActionRequest({
        uri,
        fileContent,
        diagnostics: [getDiagnostic(code)],
    });
}

function applyAction(content: string, action: CodeAction) {
    return applyTextEdits(content, action.edit!.changes![uri]);
}
