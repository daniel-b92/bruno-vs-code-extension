import { describe, it, expect } from "@jest/globals";
import {
    applyTextEdits,
    getYamlHttpRequestFile,
    pathParam,
    queryParam,
} from "@global_shared/_testingUtils";
import { CodeAction, Diagnostic } from "vscode-languageserver";
import { handleCodeActionRequest } from "./handleCodeActionRequest";
import { YamlDiagnosticCode } from "../diagnostics/yamlDiagnosticCodeEnum";

const uri = "file:///collection/request.yml";

describe("handleCodeActionRequest", () => {
    describe("query params", () => {
        it("offers both directions if the URL does not match 'params'", () => {
            const content = getYamlHttpRequestFile("/api?a=1&b=2", [
                queryParam("a", "1"),
                queryParam("c", "3"),
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
                getYamlHttpRequestFile("/api?a=1&b=2", [
                    queryParam("a", "1"),
                    queryParam("b", "2"),
                ]),
            );
        });

        it("removes the 'params' key if the URL has no query params", () => {
            const content = getYamlHttpRequestFile("/api", [
                queryParam("a", "1"),
            ]);

            const [, updateParams] = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingQueryParams,
            );

            expect(applyAction(content, updateParams)).toEqual(
                getYamlHttpRequestFile("/api"),
            );
        });

        it("links the diagnostic to the fix", () => {
            const content = getYamlHttpRequestFile("/api?a=1");
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
            const content =
                getYamlHttpRequestFile("/api?a=1").concat("  params: []\n");

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
            const content = getYamlHttpRequestFile("/api/:id");

            const actions = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingPathParams,
            );

            expect(actions.map(({ title }) => title)).toEqual([
                "Update path params in 'params' to match URL",
            ]);
            expect(applyAction(content, actions[0])).toEqual(
                getYamlHttpRequestFile("/api/:id", [pathParam("id", "")]),
            );
        });

        it("removes path params that are not part of the URL", () => {
            const content = getYamlHttpRequestFile("/api", [
                pathParam("id", ""),
            ]);

            const [action] = getActions(
                content,
                YamlDiagnosticCode.UrlNotMatchingPathParams,
            );

            expect(applyAction(content, action)).toEqual(
                getYamlHttpRequestFile("/api"),
            );
        });
    });

    it("offers no fixes for other diagnostic codes", () => {
        expect(getActions(getYamlHttpRequestFile("/api?a=1"), "bru14")).toEqual(
            [],
        );
    });

    it("offers no fixes for diagnostics without a code", () => {
        expect(
            getActions(getYamlHttpRequestFile("/api?a=1"), undefined),
        ).toEqual([]);
    });
});

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
