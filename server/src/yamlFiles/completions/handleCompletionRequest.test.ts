import { describe, it, expect } from "@jest/globals";
import {
    BrunoCollectionSettingsFile,
    BrunoFileType,
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionFormat,
    CollectionItem,
    OAuth2Flow,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import {
    applyCompletionItem,
    createCollectionWithItems,
    createItemProviderStub,
} from "@global_shared/_testingUtils";
import {
    CancellationToken,
    CompletionItemKind,
    InsertTextFormat,
    InsertTextMode,
    TextEdit,
} from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../shared";
import { YamlFormatDiagnosticsProvider } from "../yamlFormatDiagnosticsProvider";
import { handleCompletionRequest } from "./handleCompletionRequest";

const requestPath = "/collection/request.yml";
const environmentPath = "/collection/environments/Dev.yml";
const folderSettingsPath = "/collection/folder/folder.yml";
const collectionSettingsPath = "/collection/opencollection.yml";

describe("handleCompletionRequest for yaml files", () => {
    describe("key completions", () => {
        it("suggests the remaining keys of the map at the cursor", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  \nhttp:\n  method: GET\n  url: x\n",
                new Position(3, 2),
            );

            const labels = result?.map(({ label }) => label);
            expect(labels).toContain("seq");
            expect(labels).not.toContain("name");
            expect(labels).not.toContain("type");
        });

        it("replaces the typed word and inserts a map snippet for map keys", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\nht",
                new Position(3, 2),
            );

            const httpItem = result?.find(({ label }) => label == "http");
            expect(httpItem?.textEdit).toEqual({
                newText: "http:\n  $1",
                range: {
                    start: { line: 3, character: 0 },
                    end: { line: 3, character: 2 },
                },
            });
        });

        it("marks optional keys as optional and sorts mandatory keys first", async () => {
            const result = await complete(
                environmentPath,
                "name: Dev\n",
                new Position(1, 0),
                [],
                ["Dev"],
            );

            const extendsItem = result?.find(({ label }) => label == "extends");
            expect(extendsItem?.labelDetails).toEqual({ detail: " optional" });
            expect(extendsItem?.sortText).toBe("b_extends");
        });
    });

    describe("keys of an oauth2 auth", () => {
        it("marks the flow as mandatory and sorts it before the optional keys", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  auth:\n    type: oauth2\n    \n",
                new Position(4, 4),
            );

            const flowItem = result?.find(({ label }) => label == "flow");
            expect(flowItem?.sortText).toBe("a_flow");
            expect(flowItem?.labelDetails).toBeUndefined();
            const scopeItem = result?.find(({ label }) => label == "scope");
            expect(scopeItem?.sortText).toBe("b_scope");
            expect(scopeItem?.labelDetails).toEqual({ detail: " optional" });
        });
    });

    describe("key insertion", () => {
        it("inserts a sequence snippet for sequence keys", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  \n",
                new Position(3, 2),
            );

            expect(
                result?.find(({ label }) => label == "tags")?.textEdit,
            ).toMatchObject({ newText: "tags:\n    - $1" });
        });

        it("uses the indentation step of the document", async () => {
            const result = await complete(
                requestPath,
                "info:\n    name: Foo\n    \n",
                new Position(2, 4),
            );

            expect(
                result?.find(({ label }) => label == "tags")?.textEdit,
            ).toMatchObject({ newText: "tags:\n        - $1" });
        });

        it("inserts the mandatory keys of the items for a sequence of maps", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            const headersItem = result?.find(({ label }) => label == "headers");
            expect(headersItem?.textEdit).toMatchObject({
                newText: "headers:\n    - name: $1\n      value: $2",
            });
            expect(headersItem?.command).toBeUndefined();
        });

        it("lets the user choose between the allowed values of mandatory keys", async () => {
            const result = await complete(
                requestPath,
                "runtime:\n  \n",
                new Position(1, 2),
            );

            expect(
                result?.find(({ label }) => label == "scripts")?.textEdit,
            ).toMatchObject({
                newText:
                    "scripts:\n    - type: ${1|before-request,after-response,tests|}\n      code: $2",
            });
        });

        it("inserts the mandatory keys of nested maps and the only allowed values", async () => {
            const result = await complete(
                requestPath,
                "runtime:\n  \n",
                new Position(1, 2),
            );

            expect(
                result?.find(({ label }) => label == "actions")?.textEdit,
            ).toMatchObject({
                newText: [
                    "actions:",
                    "    - phase: after-response",
                    "      type: set-variable",
                    "      selector:",
                    "        expression: $1",
                    "        method: jsonq",
                    "      variable:",
                    "        name: $2",
                    "        scope: runtime",
                ].join("\n"),
            });
        });

        it("prefills the next free sequence when inserting the info map", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n",
                new Position(2, 0),
                [new BrunoRequestFile("/collection/other.yml", 4)],
            );

            expect(
                result?.find(({ label }) => label == "info")?.textEdit,
            ).toMatchObject({
                newText:
                    "info:\n  name: $1\n  type: ${2|http,graphql,grpc,websocket|}\n  seq: ${3:5}",
            });
        });

        it("triggers the suggestion for the content of a map without mandatory keys", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n",
                new Position(2, 0),
            );

            expect(
                result?.find(({ label }) => label == "http")?.command,
            ).toEqual({
                title: "Suggest",
                command: "editor.action.triggerSuggest",
            });
        });

        it("inserts the snippets with their indentation as is", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            expect(
                result?.every(
                    ({ insertTextMode }) =>
                        insertTextMode == InsertTextMode.asIs,
                ),
            ).toBe(true);
        });
        it("triggers the value suggestion for keys with a fixed set of values", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  \n",
                new Position(2, 2),
            );

            expect(
                result?.find(({ label }) => label == "type")?.command,
            ).toEqual({
                title: "Suggest",
                command: "editor.action.triggerSuggest",
            });
            expect(
                result?.find(({ label }) => label == "seq")?.command,
            ).toBeUndefined();
        });
    });

    describe("keys with values of different kinds", () => {
        it("provides a separate completion for a scalar and a map value", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            expect(result?.filter(({ label }) => label == "auth")).toEqual([
                expect.objectContaining({
                    textEdit: expect.objectContaining({
                        newText: "auth: inherit",
                    }),
                    command: undefined,
                    labelDetails: {
                        detail: " optional",
                        description: "inherit",
                    },
                    sortText: "b_auth_0",
                }),
                expect.objectContaining({
                    textEdit: expect.objectContaining({
                        newText:
                            "auth:\n    type: ${1|awsv4,basic,wsse,bearer,digest,ntlm,apikey,oauth1,oauth2,akamai-edgegrid|}",
                    }),
                    command: undefined,
                    labelDetails: { detail: " optional", description: "map" },
                    sortText: "b_auth_1",
                }),
            ]);
        });

        it("describes the scalar completion by its kind, if there is not exactly one allowed value", async () => {
            const result = await complete(
                environmentPath,
                "name: Dev\nvariables:\n  - name: a\n    \n",
                new Position(3, 4),
                [],
                ["Dev"],
            );

            const valueItems = result?.filter(({ label }) => label == "value");
            expect(
                valueItems?.map(
                    ({ labelDetails }) => labelDetails?.description,
                ),
            ).toEqual(["string", "map"]);
            expect(valueItems?.[0].textEdit).toMatchObject({
                newText: "value: ",
            });
        });

        it("does not insert the only allowed value of a key that accepts other scalar kinds", async () => {
            const result = await complete(
                requestPath,
                "settings:\n  \n",
                new Position(1, 2),
            );

            const timeoutItems = result?.filter(
                ({ label }) => label == "timeout",
            );
            expect(timeoutItems).toHaveLength(1);
            expect(timeoutItems?.[0].textEdit).toMatchObject({
                newText: "timeout: ",
            });
            expect(timeoutItems?.[0].command).toEqual({
                title: "Suggest",
                command: "editor.action.triggerSuggest",
            });
        });

        it("does not suggest inheriting the auth in a collection settings file", async () => {
            const result = await complete(
                collectionSettingsPath,
                "request:\n  \n",
                new Position(1, 2),
                [new BrunoCollectionSettingsFile(collectionSettingsPath)],
            );

            const authItems = result?.filter(({ label }) => label == "auth");
            expect(authItems).toHaveLength(1);
            expect(authItems?.[0].textEdit).toMatchObject({
                newText: expect.stringMatching(/^auth:\n {4}type: /),
            });
            expect(authItems?.[0].labelDetails).toEqual({
                detail: " optional",
            });
        });
    });

    describe("re-indentation", () => {
        it("fixes the indentation of a key that is too far in", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n     pa\n",
                new Position(2, 7),
            );

            const paramsItem = result?.find(({ label }) => label == "params");
            expect(paramsItem?.textEdit).toEqual({
                newText: "params:\n    - name: $1\n      value: $2",
                range: {
                    start: { line: 2, character: 5 },
                    end: { line: 2, character: 7 },
                },
            });
            expect(paramsItem?.additionalTextEdits).toEqual([
                {
                    newText: "  ",
                    range: {
                        start: { line: 2, character: 0 },
                        end: { line: 2, character: 5 },
                    },
                },
            ]);
        });

        it("does not change the indentation of a key at a valid position", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  \n",
                new Position(2, 2),
            );

            expect(
                result?.every(
                    ({ additionalTextEdits }) => !additionalTextEdits,
                ),
            ).toBe(true);
        });
    });

    describe("completion for all mandatory keys", () => {
        it("inserts all missing mandatory keys at once", async () => {
            const result = await complete(
                requestPath,
                "info:\n  \n",
                new Position(1, 2),
                [new BrunoRequestFile("/collection/other.yml", 1)],
            );

            expect(result?.[0]).toMatchObject({
                label: "name, type, seq",
                textEdit: {
                    newText:
                        "name: $1\n  type: ${2|http,graphql,grpc,websocket|}\n  seq: ${3:2}",
                },
            });
        });

        it("is not provided, if less than two mandatory keys are missing", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  \n",
                new Position(3, 2),
            );

            expect(result?.some(({ label }) => label.includes(","))).toBe(
                false,
            );
        });
    });

    describe("value completions", () => {
        it("suggests true and false for boolean keys", async () => {
            const result = await complete(
                requestPath,
                "http:\n  headers:\n    - name: Accept\n      disabled: \n",
                new Position(3, 16),
            );

            expect(result?.map(({ label }) => label)).toEqual([
                "true",
                "false",
            ]);
        });

        it("suggests the allowed values of an enum key", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: \n",
                new Position(2, 8),
            );

            expect(result?.map(({ label }) => label)).toEqual(
                expect.arrayContaining(["http", "graphql"]),
            );
        });

        it("suggests the next free sequence for 'info.seq'", async () => {
            const result = await complete(
                requestPath,
                "info:\n  name: Foo\n  type: http\n  seq: \n",
                new Position(3, 7),
                [new BrunoRequestFile("/collection/other.yml", 4)],
            );

            expect(result?.map(({ label }) => label)).toEqual(["5"]);
        });

        it("suggests the allowed scalar values of a key that can have a map value as well", async () => {
            const result = await complete(
                requestPath,
                "http:\n  method: GET\n  auth: \n",
                new Position(2, 8),
            );

            expect(result?.map(({ label }) => label)).toEqual(["inherit"]);
        });

        it("suggests the environments that can be extended", async () => {
            const result = await complete(
                environmentPath,
                "name: Dev\nextends: \n",
                new Position(1, 9),
                [],
                ["Base", "Dev"],
            );

            expect(result?.map(({ label }) => label)).toEqual(["Base"]);
        });
    });

    describe("values of the flow of an oauth2 auth", () => {
        const expectedTextByFlow: Record<OAuth2Flow, string> = {
            [OAuth2Flow.AuthorizationCode]:
                "authorization_code\n    authorizationUrl: $1\n    accessTokenUrl: $2\n    callbackUrl: $3\n    credentials:\n      clientId: $4\n      clientSecret: $5\n    scope: $6\n    state: $7",
            [OAuth2Flow.ClientCredentials]:
                "client_credentials\n    accessTokenUrl: $1\n    credentials:\n      clientId: $2\n      clientSecret: $3\n    scope: $4",
            [OAuth2Flow.Implicit]:
                "implicit\n    authorizationUrl: $1\n    callbackUrl: $2\n    credentials:\n      clientId: $3\n    scope: $4\n    state: $5",
            [OAuth2Flow.ResourceOwnerPasswordCredentials]:
                "resource_owner_password_credentials\n    accessTokenUrl: $1\n    resourceOwner:\n      username: $2\n      password: $3\n    credentials:\n      clientId: $4\n      clientSecret: $5\n    scope: $6",
        };

        it.each(Object.values(OAuth2Flow))(
            "inserts the keys for the flow '%s' as a snippet",
            async (flow) => {
                const { item } = await completeFlow(
                    authInRequest("    type: oauth2\n    flow: |"),
                    flow,
                );

                expect(item.textEdit).toEqual({
                    newText: expectedTextByFlow[flow],
                    range: {
                        start: { line: 9, character: 10 },
                        end: { line: 9, character: 10 },
                    },
                });
                expect(item.insertTextFormat).toBe(InsertTextFormat.Snippet);
                expect(item.insertTextMode).toBe(InsertTextMode.asIs);
                expect(item.additionalTextEdits).toBeUndefined();
            },
        );

        it("offers all flows", async () => {
            const { items } = await completeFlow(
                authInRequest("    type: oauth2\n    flow: |"),
                OAuth2Flow.Implicit,
            );

            expect(items.map(({ label }) => label)).toEqual(
                Object.values(OAuth2Flow),
            );
        });

        it("does not insert keys that are already defined", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    accessTokenUrl: https://example.com/token\n    scope: read",
                ),
                OAuth2Flow.ClientCredentials,
            );

            expect(updated).toBe(
                authInRequest(
                    "    type: oauth2\n    flow: client_credentials\n    credentials:\n      clientId: \n      clientSecret: \n    accessTokenUrl: https://example.com/token\n    scope: read",
                ),
            );
        });

        it("inserts the keys if the flow is not the last key of the auth", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    scope: read\n    type: oauth2\n    flow: |\n    state: abc",
                ),
                OAuth2Flow.Implicit,
            );

            expect(updated).toBe(
                authInRequest(
                    "    scope: read\n    type: oauth2\n    flow: implicit\n    authorizationUrl: \n    callbackUrl: \n    credentials:\n      clientId: \n    state: abc",
                ),
            );
        });

        it.each([
            [
                "before",
                "    credentials:\n      clientId: abc\n    type: oauth2\n    flow: |",
                "    credentials:\n      clientId: abc\n      clientSecret: \n    type: oauth2\n    flow: client_credentials\n    accessTokenUrl: \n    scope: ",
            ],
            [
                "after",
                "    type: oauth2\n    flow: |\n    credentials:\n      clientId: abc",
                "    type: oauth2\n    flow: client_credentials\n    accessTokenUrl: \n    scope: \n    credentials:\n      clientId: abc\n      clientSecret: ",
            ],
        ])(
            "adds only the missing keys to an existing credentials map that is %s the flow",
            async (_description, authContent, expectedAuthContent) => {
                const { item, updated } = await completeFlow(
                    authInRequest(authContent),
                    OAuth2Flow.ClientCredentials,
                );

                expect(item.additionalTextEdits).toHaveLength(1);
                expect(updated).toBe(authInRequest(expectedAuthContent));
            },
        );

        it("keeps a trailing comment of the last credentials key in place", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    credentials:\n      clientId: abc # my client",
                ),
                OAuth2Flow.ClientCredentials,
            );

            expect(updated).toContain(
                "      clientId: abc # my client\n      clientSecret: ",
            );
        });

        it("does not change a complete credentials map", async () => {
            const { item, updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    accessTokenUrl: a\n    scope: b\n    credentials:\n      clientSecret: s\n      clientId: c",
                ),
                OAuth2Flow.ClientCredentials,
            );

            expect(item.additionalTextEdits).toBeUndefined();
            expect(item.insertTextFormat).toBeUndefined();
            expect(updated).toContain("flow: client_credentials\n");
            expect(updated.match(/clientId/g)).toHaveLength(1);
        });

        it("inserts the child keys below a credentials key without value", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    credentials:\n    scope: read",
                ),
                OAuth2Flow.ClientCredentials,
            );

            expect(updated).toBe(
                authInRequest(
                    "    type: oauth2\n    flow: client_credentials\n    accessTokenUrl: \n    credentials:\n      clientId: \n      clientSecret: \n    scope: read",
                ),
            );
        });

        it("adds missing keys to the resource owner map", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    resourceOwner:\n      password: pw",
                ),
                OAuth2Flow.ResourceOwnerPasswordCredentials,
            );

            expect(updated).toContain(
                "    resourceOwner:\n      password: pw\n      username: \n",
            );
        });

        it.each(["foo", "{ clientId: abc }"])(
            "does not touch a credentials key with the value '%s'",
            async (value) => {
                const { item, updated } = await completeFlow(
                    authInRequest(
                        `    type: oauth2\n    flow: |\n    credentials: ${value}`,
                    ),
                    OAuth2Flow.ClientCredentials,
                );

                expect(item.additionalTextEdits).toBeUndefined();
                expect(updated).toContain(`    credentials: ${value}\n`);
                expect(updated.match(/^ +credentials:/gm)).toHaveLength(1);
            },
        );

        it("returns a plain item if all keys are defined", async () => {
            const { item } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    accessTokenUrl: a\n    credentials:\n      clientId: c\n      clientSecret: s\n    scope: b",
                ),
                OAuth2Flow.ClientCredentials,
            );

            expect(item).toEqual({
                label: "client_credentials",
                kind: CompletionItemKind.Value,
                textEdit: {
                    newText: "client_credentials",
                    range: {
                        start: { line: 9, character: 10 },
                        end: { line: 9, character: 10 },
                    },
                },
            });
        });

        it("uses the indentation step of the document", async () => {
            const { item } = await completeFlow(
                "info:\n    name: Foo\n    type: http\nhttp:\n    method: GET\n    auth:\n        type: oauth2\n        flow: |\n",
                OAuth2Flow.ClientCredentials,
            );

            expect(item.textEdit?.newText).toBe(
                "client_credentials\n        accessTokenUrl: $1\n        credentials:\n            clientId: $2\n            clientSecret: $3\n        scope: $4",
            );
        });

        it.each([
            [
                "request.auth in a folder settings file",
                folderSettingsPath,
                "info:\n  name: Foo\nrequest:\n  auth:\n    type: oauth2\n    flow: |\n",
            ],
            [
                "request.auth in a collection settings file",
                collectionSettingsPath,
                "opencollection: 1.0.0\ninfo:\n  name: Foo\nrequest:\n  auth:\n    type: oauth2\n    flow: |\n",
            ],
            [
                "graphql.auth in a request file",
                requestPath,
                "info:\n  name: Foo\n  type: graphql\ngraphql:\n  auth:\n    type: oauth2\n    flow: |\n",
            ],
            [
                "websocket.auth in a request file",
                requestPath,
                "info:\n  name: Foo\n  type: websocket\nwebsocket:\n  auth:\n    type: oauth2\n    flow: |\n",
            ],
        ])(
            "inserts the keys for %s",
            async (_description, filePath, textWithCursor) => {
                const { item } = await completeFlow(
                    textWithCursor,
                    OAuth2Flow.Implicit,
                    filePath,
                );

                expect(item.textEdit?.newText).toBe(
                    expectedTextByFlow[OAuth2Flow.Implicit],
                );
            },
        );

        it("uses CRLF line breaks if the file uses them", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: |\n    credentials:\n      clientId: abc",
                ).replace(/\n/g, "\r\n"),
                OAuth2Flow.ClientCredentials,
            );

            expect(updated).toContain(
                "flow: client_credentials\r\n    accessTokenUrl: \r\n    scope: ",
            );
            expect(updated).toContain("clientId: abc\r\n      clientSecret: ");
            expect(updated.replace(/\r\n/g, "")).not.toContain("\n");
        });

        it("inserts a space if the cursor is directly after the colon", async () => {
            const { item } = await completeFlow(
                authInRequest("    type: oauth2\n    flow:|"),
                OAuth2Flow.ClientCredentials,
            );

            expect(item.textEdit?.newText).toBe(
                ` ${expectedTextByFlow[OAuth2Flow.ClientCredentials]}`,
            );
        });

        it("replaces a partly typed value and keeps a trailing comment in the line of the flow", async () => {
            const { updated } = await completeFlow(
                authInRequest(
                    "    type: oauth2\n    flow: cli| # the flow\n    scope: read",
                ),
                OAuth2Flow.ClientCredentials,
            );

            expect(updated).toBe(
                authInRequest(
                    "    type: oauth2\n    flow: client_credentials # the flow\n    accessTokenUrl: \n    credentials:\n      clientId: \n      clientSecret: \n    scope: read",
                ),
            );
        });

        it("keeps a trailing comment after an empty flow", async () => {
            const { updated } = await completeFlow(
                authInRequest("    type: oauth2\n    flow: | # the flow"),
                OAuth2Flow.Implicit,
            );

            expect(updated).toContain(
                "    flow: implicit # the flow\n    authorizationUrl: ",
            );
        });

        it("does not suggest flows for a flow key outside an oauth2 auth", async () => {
            const { text, position } = splitCursor(
                authInRequest("    type: basic\n    flow: |"),
            );

            const result = await complete(requestPath, text, position);

            expect(result).toBeUndefined();
        });

        describe("diagnostics after applying the completion", () => {
            const provider = new YamlFormatDiagnosticsProvider(
                createItemProviderStub<TypedCollectionItemProvider>(
                    "/collection",
                    CollectionFormat.Yaml,
                ),
            );

            // The ranges are ignored, since the inserted keys move the other diagnostics.
            const getMessages = (
                filePath: string,
                content: string,
                fileType: BrunoFileType,
            ) =>
                provider
                    .getDiagnosticsForYamlFile(filePath, content, fileType)
                    .map(({ message, severity }) => ({ message, severity }));

            it.each(Object.values(OAuth2Flow))(
                "reports no new diagnostics in a request file for the flow '%s'",
                async (flow) => {
                    const { updated } = await completeFlow(
                        authInRequest("    type: oauth2\n    flow: |"),
                        flow,
                    );

                    expect(
                        getMessages(
                            requestPath,
                            updated,
                            BrunoFileType.RequestFile,
                        ),
                    ).toEqual(
                        getMessages(
                            requestPath,
                            requestWithoutAuth,
                            BrunoFileType.RequestFile,
                        ),
                    );
                },
            );

            it.each(Object.values(OAuth2Flow))(
                "reports no new diagnostics in a collection settings file for the flow '%s'",
                async (flow) => {
                    const withoutAuth =
                        "opencollection: 1.0.0\ninfo:\n  name: Foo\n";
                    const { updated } = await completeFlow(
                        `${withoutAuth}request:\n  auth:\n    type: oauth2\n    flow: |\n`,
                        flow,
                        collectionSettingsPath,
                    );

                    expect(
                        getMessages(
                            collectionSettingsPath,
                            updated,
                            BrunoFileType.CollectionSettingsFile,
                        ),
                    ).toEqual(
                        getMessages(
                            collectionSettingsPath,
                            withoutAuth,
                            BrunoFileType.CollectionSettingsFile,
                        ),
                    );
                },
            );
        });
    });

    it("replaces the rest of the line when completing a value", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo\n  type: ht\n",
            new Position(2, 9),
        );

        expect(result?.find(({ label }) => label == "http")?.textEdit).toEqual({
            newText: "http",
            range: {
                start: { line: 2, character: 8 },
                end: { line: 2, character: 10 },
            },
        });
    });

    it("keeps the space after the colon when completing a value", async () => {
        const result = await complete(
            requestPath,
            "http:\n  headers:\n    - name: Accept\n      disabled: \n",
            new Position(3, 16),
        );

        expect(result?.find(({ label }) => label == "false")?.textEdit).toEqual(
            {
                newText: "false",
                range: {
                    start: { line: 3, character: 16 },
                    end: { line: 3, character: 16 },
                },
            },
        );
    });

    it("inserts a space before the value, if it directly follows the colon", async () => {
        const result = await complete(
            requestPath,
            "http:\n  headers:\n    - name: Accept\n      disabled:\n",
            new Position(3, 15),
        );

        expect(result?.find(({ label }) => label == "false")?.textEdit).toEqual(
            {
                newText: " false",
                range: {
                    start: { line: 3, character: 15 },
                    end: { line: 3, character: 15 },
                },
            },
        );
    });

    it("does not suggest tags that are already defined", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo\n  tags:\n    - a\n    - \n",
            new Position(4, 6),
            [new BrunoRequestFile("/collection/other.yml", 1, ["a", "b"])],
        );

        expect(result?.map(({ label }) => label)).toEqual(["b"]);
    });

    it("returns no completions for a position within a value", async () => {
        const result = await complete(
            requestPath,
            "info:\n  name: Foo bar\n",
            new Position(1, 12),
        );

        expect(result).toBeUndefined();
    });

    describe("variable completions", () => {
        it("suggests variables within `{{` in non-code sections", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
  method: GET
  url: "{{"
`,
                new Position(7, 10),
            );

            expect(result?.map(({ label }) => label)).toContain("dyn");
        });

        it("does not suggest variables when the cursor is behind the closing quote of a string", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
  method: GET
  url: "{{dy}}"
`,
                new Position(7, 15),
            );

            expect(result ?? []).toEqual([]);
        });

        it("wraps the value in quotes when `{{` starts an unquoted value", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
  method: GET
  url: {{dy
`,
                new Position(7, 11),
            );

            const item = result?.find(({ label }) => label == "dyn");
            expect(item?.filterText).toBe("{{dyn");
            expect(item?.textEdit).toEqual({
                newText: `"{{dyn}}"`,
                range: {
                    start: { line: 7, character: 7 },
                    end: { line: 7, character: 11 },
                },
            });
        });

        it("replaces existing closing braces when wrapping an unquoted value in quotes", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
  method: GET
  url: {{dy}}
`,
                new Position(7, 11),
            );

            expect(
                result?.find(({ label }) => label == "dyn")?.textEdit,
            ).toEqual({
                newText: `"{{dyn}}"`,
                range: {
                    start: { line: 7, character: 7 },
                    end: { line: 7, character: 13 },
                },
            });
        });

        it("does not wrap the value in quotes when more text follows the variable", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
  method: GET
  url: {{dy}}/path
`,
                new Position(7, 11),
            );

            expect(
                result?.find(({ label }) => label == "dyn")?.textEdit,
            ).toEqual({
                newText: "dyn",
                range: {
                    start: { line: 7, character: 9 },
                    end: { line: 7, character: 11 },
                },
            });
        });

        it.each([
            ['  "X-Api-Key": {{dy', 19],
            ["  x.y: {{dy", 11],
            ["  url: {{dy # comment", 11],
        ])(
            "wraps the value in quotes for the unquoted value '%s'",
            async (line, character) => {
                const result = await complete(
                    requestPath,
                    `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
${line}
`,
                    new Position(6, character),
                );

                const item = result?.find(({ label }) => label == "dyn");
                expect((item?.textEdit as TextEdit | undefined)?.newText).toBe(
                    `"{{dyn}}"`,
                );
            },
        );

        it("does not wrap the value in quotes within a block scalar", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("dyn", 1);
http:
  body:
    type: text
    data: |-
      {{dy
`,
                new Position(9, 10),
            );

            expect(
                result?.find(({ label }) => label == "dyn")?.textEdit,
            ).toEqual({
                newText: "dyn}}",
                range: {
                    start: { line: 9, character: 8 },
                    end: { line: 9, character: 10 },
                },
            });
        });

        it("suggests runtime variables set in earlier scripts for 'bru.deleteVar' and marks them as deletion", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setVar("token", 1);
    - type: after-response
      code: |
        bru.deleteVar("");
`,
                new Position(7, 23),
            );

            const item = result?.find(({ label }) => label == "token");

            // The label is inserted into the document, so the marker must not be part of it.
            expect(item?.label).toBe("token");
            expect(item?.labelDetails?.description).toContain("⚠ Delete");
        });

        it("suggests environment variables set in earlier scripts for 'bru.deleteEnvVar' and marks them as deletion", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.setEnvVar("token", 1);
    - type: after-response
      code: |
        bru.deleteEnvVar("");
`,
                new Position(7, 26),
            );

            const item = result?.find(({ label }) => label == "token");

            expect(item?.label).toBe("token");
            expect(item?.labelDetails?.description).toContain("⚠ Delete");
        });

        it("does not suggest runtime variables set in later scripts for 'bru.deleteVar'", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: before-request
      code: |
        bru.deleteVar("");
    - type: after-response
      code: |
        bru.setVar("token", 1);
`,
                new Position(4, 23),
            );

            expect(result?.map(({ label }) => label) ?? []).not.toContain(
                "token",
            );
        });

        it("suggests variables for variable access within scripts", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  variables:
    - name: first
      value: "1"
  scripts:
    - type: before-request
      code: |
        bru.getRequestVar("");
`,
                new Position(7, 27),
            );

            expect(result?.map(({ label }) => label)).toContain("first");
        });

        it("does not suggest keys within scripts", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  scripts:
    - type: after-response
      code: |
        con
`,
                new Position(4, 11),
            );

            expect(result ?? []).toEqual([]);
        });
    });

    describe("names of script variables", () => {
        it("suggests variables that are read in a before-request script for 'variables[].name'", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  variables:
    - name: 
      value: "1"
  scripts:
    - type: before-request
      code: |
        bru.getRequestVar("token");
`,
                new Position(2, 12),
            );

            expect(result?.map(({ label }) => label)).toEqual(["token"]);
            expect(result?.[0].textEdit).toEqual({
                range: { start: new Position(2, 12), end: new Position(2, 12) },
                newText: "token",
            });
        });

        it("inserts a separating space, if the cursor directly follows the colon", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  variables:
    - name:
  scripts:
    - type: before-request
      code: |
        bru.getRequestVar("token");
`,
                new Position(2, 11),
            );

            expect(
                result?.map(({ textEdit }) => (textEdit as TextEdit).newText),
            ).toEqual([" token"]);
        });

        it("suggests runtime variables that are read in an after-response script for the name of 'set-variable' actions", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  actions:
    - type: set-variable
      variable:
        name: 
  scripts:
    - type: after-response
      code: |
        bru.getVar("token");
`,
                new Position(4, 14),
            );

            expect(result?.map(({ label }) => label)).toEqual(["token"]);
        });

        it("does not suggest request variables that are read in an after-response script for the name of 'set-variable' actions", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  actions:
    - type: set-variable
      variable:
        name: 
  scripts:
    - type: after-response
      code: |
        bru.getRequestVar("token");
`,
                new Position(4, 14),
            );

            expect(result?.map(({ label }) => label) ?? []).toEqual([]);
        });

        it("does not suggest names that are already defined in other items", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  variables:
    - name: token
      value: "1"
    - name: 
      value: "2"
  scripts:
    - type: before-request
      code: |
        bru.getRequestVar("token");
        bru.getRequestVar("other");
`,
                new Position(4, 12),
            );

            expect(result?.map(({ label }) => label)).toEqual(["other"]);
        });

        it("suggests names that are only read in the values of other script variables", async () => {
            const result = await complete(
                requestPath,
                `runtime:
  variables:
    - name: other
      value: "{{token}}"
    - name: 
      value: "2"
  scripts:
    - type: before-request
      code: |
        bru.getRequestVar("token");
`,
                new Position(4, 12),
            );

            expect(result?.map(({ label }) => label)).toContain("token");
        });

        it("uses the 'request' container in folder settings files", async () => {
            const result = await complete(
                folderSettingsPath,
                `request:
  variables:
    - name: 
  scripts:
    - type: before-request
      code: |
        bru.getFolderVar("token");
`,
                new Position(2, 12),
                [new BrunoFolderSettingsFile(folderSettingsPath)],
            );

            expect(result?.map(({ label }) => label)).toEqual(["token"]);
        });
    });
});

async function complete(
    filePath: string,
    text: string,
    position: Position,
    additionalItems: CollectionItem[] = [],
    environments: string[] = [],
) {
    const { collection, itemProvider } =
        createCollectionWithItems<TypedCollectionItemProvider>(
            [...additionalItems, new BrunoRequestFile(requestPath)],
            CollectionFormat.Yaml,
            environments,
        );

    return handleCompletionRequest({
        baseRequest: {
            filePath,
            documentHelper: new TextDocumentHelper(text),
            position,
            token: CancellationToken.None,
        },
        collection,
        itemProvider,
    });
}

const requestWithoutAuth =
    "info:\n  name: Foo\n  type: http\n  seq: 1\nhttp:\n  method: GET\n  url: /api\n";

/** The content of the auth is indented by 4 spaces. The `flow` is expected to be on line 9 (if it is the first key after `type`). */
function authInRequest(authContent: string) {
    return `${requestWithoutAuth}  auth:\n${authContent}\n`;
}

/** Removes the cursor marker `|` from the text and returns its position. */
function splitCursor(textWithCursor: string) {
    const offset = textWithCursor.indexOf("|");
    const textBefore = textWithCursor.substring(0, offset);
    const lines = textBefore.split("\n");

    return {
        text: textBefore + textWithCursor.substring(offset + 1),
        position: new Position(
            lines.length - 1,
            lines[lines.length - 1].length,
        ),
    };
}

/** Requests the completions at the cursor marker `|` and applies the one for the given flow. */
async function completeFlow(
    textWithCursor: string,
    flow: OAuth2Flow,
    filePath = requestPath,
) {
    const { text, position } = splitCursor(textWithCursor);
    const items =
        (await complete(
            filePath,
            text,
            position,
            filePath == folderSettingsPath
                ? [new BrunoFolderSettingsFile(folderSettingsPath)]
                : filePath == collectionSettingsPath
                  ? [new BrunoCollectionSettingsFile(collectionSettingsPath)]
                  : [],
        )) ?? [];
    const item = items.find(({ label }) => label == flow);

    if (!item) {
        throw new Error(
            `Expected a completion for the flow '${flow}'. Got: ${JSON.stringify(items.map(({ label }) => label))}`,
        );
    }

    return { items, item, updated: applyCompletionItem(text, item) };
}
