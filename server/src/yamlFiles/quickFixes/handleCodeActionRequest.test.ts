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
import { BrunoFileType, CollectionFormat } from "@global_shared";
import { createItemProviderStub } from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "../../shared/interfaces";
import { YamlFormatDiagnosticsProvider } from "../yamlFormatDiagnosticsProvider";

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
                fileType: BrunoFileType.RequestFile,
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

    it("offers no fixes for params in other files than request files", () => {
        const content = getYamlHttpRequestFile("/api?a=1");

        expect(
            handleCodeActionRequest({
                uri,
                fileContent: content,
                diagnostics: [
                    getDiagnostic(YamlDiagnosticCode.UrlNotMatchingQueryParams),
                ],
                fileType: BrunoFileType.FolderSettingsFile,
            }),
        ).toEqual([]);
    });

    describe("ignored oauth2 keys", () => {
        const folderSettingsFile = (auth: string) => `info:
  name: folder
  type: folder
request:
  auth:
    type: oauth2
    flow: client_credentials
${auth}
  headers:
    - name: h
      value: v
`;

        it("removes the key with its nested content for every file type with an auth", () => {
            const authLines = `    authorizationUrl: https://example.com/auth
    pkce: {}
    additionalParameters:
      authorizationRequest:
        - name: a
          value: b
    scope: read`;

            [
                {
                    fileType: BrunoFileType.FolderSettingsFile,
                    content: folderSettingsFile(authLines),
                },
                {
                    fileType: BrunoFileType.CollectionSettingsFile,
                    content: `opencollection: 1.0.0
${folderSettingsFile(authLines)}`,
                },
            ].forEach(({ fileType, content }) => {
                const diagnostics = getOAuth2Diagnostics(content, fileType);
                const actions = handleCodeActionRequest({
                    uri,
                    fileContent: content,
                    diagnostics,
                    fileType,
                });

                expect(actions.map(({ title }) => title)).toEqual([
                    "Remove key 'authorizationUrl'",
                    "Remove key 'pkce'",
                    "Remove key 'additionalParameters.authorizationRequest'",
                ]);
                expect(applyAction(content, actions[0])).toEqual(
                    content.replace(
                        "    authorizationUrl: https://example.com/auth\n",
                        "",
                    ),
                );
                expect(applyAction(content, actions[1])).toEqual(
                    content.replace("    pkce: {}\n", ""),
                );
                // The empty parent key stays in place.
                expect(applyAction(content, actions[2])).toEqual(
                    content.replace(
                        "      authorizationRequest:\n        - name: a\n          value: b\n",
                        "",
                    ),
                );
            });
        });

        it("links the diagnostic to the fix and leaves no new diagnostics after applying all fixes", () => {
            const content = folderSettingsFile(`    state: abc
    callbackUrl: https://example.com/callback`);
            const diagnostics = getOAuth2Diagnostics(
                content,
                BrunoFileType.FolderSettingsFile,
            );

            const actions = handleCodeActionRequest({
                uri,
                fileContent: content,
                diagnostics,
                fileType: BrunoFileType.FolderSettingsFile,
            });

            expect(actions.map((action) => action.diagnostics)).toEqual(
                diagnostics.map((diagnostic) => [diagnostic]),
            );
            const fixed = applyTextEdits(
                content,
                actions.flatMap((action) => action.edit!.changes![uri]),
            );
            expect(fixed).toEqual(folderSettingsFile("").replace("\n\n", "\n"));
            expect(
                getOAuth2Diagnostics(fixed, BrunoFileType.FolderSettingsFile),
            ).toEqual([]);
        });

        it("removes the last line of a file without a trailing line break", () => {
            const content = `info:
  name: folder
  type: folder
request:
  auth:
    type: oauth2
    flow: client_credentials
    state: abc`;
            const diagnostics = getOAuth2Diagnostics(
                content,
                BrunoFileType.FolderSettingsFile,
            );

            const [action] = handleCodeActionRequest({
                uri,
                fileContent: content,
                diagnostics,
                fileType: BrunoFileType.FolderSettingsFile,
            });

            expect(applyAction(content, action)).toEqual(
                `info:
  name: folder
  type: folder
request:
  auth:
    type: oauth2
    flow: client_credentials
`,
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
        fileType: BrunoFileType.RequestFile,
    });
}

function applyAction(content: string, action: CodeAction) {
    return applyTextEdits(content, action.edit!.changes![uri]);
}

function getOAuth2Diagnostics(content: string, fileType: BrunoFileType) {
    return new YamlFormatDiagnosticsProvider(
        createItemProviderStub<TypedCollectionItemProvider>(
            "/collection",
            CollectionFormat.Yaml,
        ),
    ).getDiagnosticsForYamlFile(uri, content, fileType);
}
