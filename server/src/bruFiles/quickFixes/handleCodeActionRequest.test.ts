import { describe, it, expect } from "@jest/globals";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { handleCodeActionRequest } from "./handleCodeActionRequest";
import { NonBlockSpecificDiagnosticCode } from "../diagnostics/shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

const uri = "file:///collection/request.bru";

describe("handleCodeActionRequest", () => {
    describe("query params", () => {
        it("offers both directions if the URL does not match the query params block", () => {
            const content = getRequestFile(
                "https://example.com?a=1&b=2",
                "params:query {\n  a: 1\n  c: 3\n}",
            );

            const actions = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
            );

            expect(actions.map(({ title }) => title)).toEqual([
                "Update URL to match 'params:query' block",
                "Update 'params:query' block to match URL",
            ]);
            expect(applyAction(content, actions[0])).toEqual(
                getRequestFile(
                    "https://example.com?a=1&c=3",
                    "params:query {\n  a: 1\n  c: 3\n}",
                ),
            );
            expect(applyAction(content, actions[1])).toEqual(
                getRequestFile(
                    "https://example.com?a=1&b=2",
                    "params:query {\n  a: 1\n  b: 2\n}",
                ),
            );
        });

        it("keeps disabled entries when updating the query params block", () => {
            const content = getRequestFile(
                "https://example.com?a=1",
                "params:query {\n  b: 2\n  ~c: 3\n}",
            );

            const [, updateBlock] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
            );

            expect(applyAction(content, updateBlock)).toEqual(
                getRequestFile(
                    "https://example.com?a=1",
                    "params:query {\n  a: 1\n  ~c: 3\n}",
                ),
            );
        });

        it("removes all enabled entries from the query params block if the URL has no query params", () => {
            const content = getRequestFile(
                "https://example.com",
                "params:query {\n  a: 1\n  ~b: 2\n}",
            );

            const [, updateBlock] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
            );

            expect(applyAction(content, updateBlock)).toEqual(
                getRequestFile(
                    "https://example.com",
                    "params:query {\n  ~b: 2\n}",
                ),
            );
        });

        it("keeps the values from the URL as they are written and fills an empty query params block", () => {
            const content = getRequestFile(
                "https://example.com?a=b%20c&d",
                "params:query {\n}",
            );

            const [updateBlock] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
            );

            expect(applyAction(content, updateBlock)).toEqual(
                getRequestFile(
                    "https://example.com?a=b%20c&d",
                    "params:query {\n  a: b%20c\n  d: \n}",
                ),
            );
        });

        it("offers to remove the query params from the URL or to add the missing query params block", () => {
            const content = getRequestFile("https://example.com?a=1&b=2");

            const actions = getActions(
                content,
                NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
            );

            expect(actions.map(({ title }) => title)).toEqual([
                "Remove query params from URL",
                "Update 'params:query' block to match URL",
            ]);
            expect(applyAction(content, actions[0])).toEqual(
                getRequestFile("https://example.com"),
            );
            expect(applyAction(content, actions[1])).toEqual(
                getRequestFile(
                    "https://example.com?a=1&b=2",
                    "params:query {\n  a: 1\n  b: 2\n}",
                ),
            );
        });

        it("removes the whole query params block if no entries would be left", () => {
            const content = `${getRequestFile(
                "https://example.com",
                "params:query {\n  a: 1\n  b: 2\n}",
            )}\nbody:json {\n  {}\n}\n`;

            const [, updateBlock] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
            );

            expect(applyAction(content, updateBlock)).toEqual(
                `${getRequestFile("https://example.com")}\nbody:json {\n  {}\n}\n`,
            );
        });

        it("removes the whole query params block if it is the last block of the file", () => {
            const content = getRequestFile(
                "https://example.com",
                "params:query {\n  a: 1\n}",
            );

            const [, updateBlock] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
            );

            expect(applyAction(content, updateBlock)).toEqual(
                getRequestFile("https://example.com"),
            );
        });

        it("uses the line break style of the file", () => {
            const content = getRequestFile("https://example.com?a=1").replace(
                /\n/g,
                "\r\n",
            );

            const [, action] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
            );

            expect(applyAction(content, action)).toEqual(
                getRequestFile(
                    "https://example.com?a=1",
                    "params:query {\n  a: 1\n}",
                ).replace(/\n/g, "\r\n"),
            );
        });

        it("offers no fixes if the query params block is not a valid dictionary block", () => {
            const content = getRequestFile(
                "https://example.com?a=1",
                "params:query {\n  a: 1\n  some invalid line\n}",
            );

            expect(
                getActions(
                    content,
                    NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingQueryParamsBlock,
                ),
            ).toEqual([]);
        });
    });

    describe("path params", () => {
        it("adds missing entries to the path params block", () => {
            const content = getRequestFile(
                "https://example.com/:a/:b",
                "params:path {\n  a: 1\n}",
            );

            const actions = getActions(
                content,
                NonBlockSpecificDiagnosticCode.PathParamsBlockMissingValuesFromUrl,
            );

            expect(actions.map(({ title }) => title)).toEqual([
                "Update 'params:path' block to match URL",
            ]);
            expect(applyAction(content, actions[0])).toEqual(
                getRequestFile(
                    "https://example.com/:a/:b",
                    "params:path {\n  a: 1\n  b: \n}",
                ),
            );
        });

        it("adds a missing path params block", () => {
            const content = getRequestFile("https://example.com/:a");

            const [action] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.PathParamsBlockMissing,
            );

            expect(applyAction(content, action)).toEqual(
                getRequestFile(
                    "https://example.com/:a",
                    "params:path {\n  a: \n}",
                ),
            );
        });

        it("removes entries from the path params block that are not part of the URL", () => {
            const content = getRequestFile(
                "https://example.com/:a",
                "params:path {\n  a: 1\n  b: 2\n}",
            );

            const [action] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingPathParams,
            );

            expect(applyAction(content, action)).toEqual(
                getRequestFile(
                    "https://example.com/:a",
                    "params:path {\n  a: 1\n}",
                ),
            );
        });

        it("adds and removes entries at once if the URL and the path params block both have entries the other one lacks", () => {
            const content = getRequestFile(
                "https://example.com/:a/:c",
                "params:path {\n  a: 1\n  b: 2\n}",
            );

            const [action] = getActions(
                content,
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockNotMatchingPathParamsBlock,
            );

            expect(applyAction(content, action)).toEqual(
                getRequestFile(
                    "https://example.com/:a/:c",
                    "params:path {\n  a: 1\n  c: \n}",
                ),
            );
        });
    });

    it("offers no fixes for other diagnostics", () => {
        const content = getRequestFile(
            "https://example.com?a=1",
            "params:query {\n  b: 1\n}",
        );

        expect(
            getActions(
                content,
                NonBlockSpecificDiagnosticCode.MissingMetaBlock,
            ),
        ).toEqual([]);
    });

    it("offers no fixes for request types that do not support URL params", () => {
        const content = getRequestFile(
            "grpc://example.com?a=1",
            undefined,
            "grpc",
        ).replace("get {", "grpc {");

        expect(
            getActions(
                content,
                NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
            ),
        ).toEqual([]);
    });

    it("offers a fix shared by multiple diagnostics only once", () => {
        const content = getRequestFile(
            "https://example.com/:a/:c",
            "params:path {\n  a: 1\n  b: 2\n}",
        );
        const diagnostics = [
            getDiagnostic(
                NonBlockSpecificDiagnosticCode.UrlFromMethodBlockMissingPathParams,
            ),
            getDiagnostic(
                NonBlockSpecificDiagnosticCode.PathParamsBlockMissingValuesFromUrl,
            ),
        ];

        const actions = handleCodeActionRequest({
            uri,
            fileContent: content,
            diagnostics,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0].diagnostics).toEqual(diagnostics);
    });

    it("links each fix to the diagnostic it belongs to", () => {
        const content = getRequestFile("https://example.com?a=1");
        const diagnostic = getDiagnostic(
            NonBlockSpecificDiagnosticCode.QueryParamsBlockMissing,
        );

        const [action] = handleCodeActionRequest({
            uri,
            fileContent: content,
            diagnostics: [diagnostic],
        });

        expect(action.diagnostics).toEqual([diagnostic]);
    });
});

function getRequestFile(url: string, additionalBlock?: string, type = "http") {
    return [
        `meta {\n  name: request\n  type: ${type}\n  seq: 1\n}`,
        `get {\n  url: ${url}\n  body: none\n  auth: none\n}`,
        ...(additionalBlock ? [additionalBlock] : []),
    ]
        .join("\n\n")
        .concat("\n");
}

function getDiagnostic(code: string): Diagnostic {
    return {
        message: "",
        code,
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        },
    };
}

function getActions(content: string, diagnosticCode: string) {
    return handleCodeActionRequest({
        uri,
        fileContent: content,
        diagnostics: [getDiagnostic(diagnosticCode)],
    });
}

function applyAction(
    content: string,
    action: ReturnType<typeof handleCodeActionRequest>[number],
) {
    return TextDocument.applyEdits(
        TextDocument.create(uri, "bru", 1, content),
        action.edit?.changes?.[uri] ?? [],
    );
}
