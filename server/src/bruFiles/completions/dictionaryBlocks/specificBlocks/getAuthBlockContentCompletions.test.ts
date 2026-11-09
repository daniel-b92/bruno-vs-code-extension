import { describe, expect, it } from "@jest/globals";
import {
    AuthBlockName,
    isBlockDictionaryBlock,
    OAuth2GrantType,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import {
    applyTextEdits,
    parseBlocksFromRequestFileContent,
} from "@global_shared/_testingUtils";
import {
    CancellationToken,
    CompletionItem,
    InsertTextFormat,
    TextEdit,
} from "vscode-languageserver";
import { getAuthBlockSpecificDiagnostics } from "../../../diagnostics/getAuthBlockSpecificDiagnostics";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getAuthBlockContentCompletions } from "./getAuthBlockContentCompletions";

describe("getAuthBlockContentCompletions", () => {
    describe("value completions for the 'grant_type' field of an OAuth2 auth block", () => {
        it.each(Object.values(OAuth2GrantType))(
            "leaves no missing mandatory fields after selecting '%s'",
            (grantType) => {
                const content = getOAuth2BlockContent("");

                const diagnostics =
                    getDiagnosticsAfterSelectingGrantTypeCompletion(
                        content,
                        grantType,
                    );

                expect(diagnostics).toEqual([]);
            },
        );

        it("does not insert duplicates of fields that are already defined", () => {
            const content = getOAuth2BlockContent(
                "\n  client_id: some-client-id",
            );

            const diagnostics =
                getDiagnosticsAfterSelectingGrantTypeCompletion(
                    content,
                    OAuth2GrantType.ClientCredentials,
                );

            expect(diagnostics).toEqual([]);
        });

        it("only replaces the value if all mandatory fields are already defined", () => {
            const content = getOAuth2BlockContent(
                "\n  access_token_url: https://example.com/token" +
                    "\n  refresh_token_url: https://example.com/refresh" +
                    "\n  client_id: some-client-id" +
                    "\n  client_secret: some-secret" +
                    "\n  credentials_id: some-credentials-id" +
                    "\n  token_placement: header" +
                    "\n  token_header_prefix: Bearer" +
                    "\n  auto_fetch_token: true" +
                    "\n  auto_refresh_token: false" +
                    "\n  credentials_placement: body" +
                    "\n  scope: read" +
                    "\n  token_source: token",
            );

            const updatedContent = getContentAfterSelectingGrantTypeCompletion(
                content,
                OAuth2GrantType.ClientCredentials,
            );

            expect(updatedContent).toBe(
                content.replace(
                    "grant_type: ",
                    `grant_type: ${OAuth2GrantType.ClientCredentials}`,
                ),
            );
        });
    });
});

function getOAuth2BlockContent(additionalFields: string) {
    return `meta {\n  name: request\n  type: http\n  seq: 1\n}\n\nget {\n  url: https://example.com\n}\n\nauth:oauth2 {\n  grant_type: ${additionalFields}\n}\n`;
}

function getDiagnosticsAfterSelectingGrantTypeCompletion(
    content: string,
    grantType: OAuth2GrantType,
) {
    const updatedContent = getContentAfterSelectingGrantTypeCompletion(
        content,
        grantType,
    );
    const updatedBlock = parseBlocksFromRequestFileContent(
        updatedContent,
    ).find(({ name }) => name == AuthBlockName.OAuth2Auth);

    if (!updatedBlock || !isBlockDictionaryBlock(updatedBlock)) {
        throw new Error(
            `Expected to find an 'auth:oauth2' dictionary block after applying the completion. Updated content:\n${updatedContent}`,
        );
    }

    return getAuthBlockSpecificDiagnostics(
        "/collection/request.bru",
        updatedBlock,
    ).filter((diagnostic) => diagnostic != undefined);
}

function getContentAfterSelectingGrantTypeCompletion(
    content: string,
    grantType: OAuth2GrantType,
) {
    const grantTypeLineIndex = 11;
    const request: LanguageFeatureBaseRequest = {
        filePath: "/collection/request.bru",
        documentHelper: new TextDocumentHelper(content),
        position: new Position(grantTypeLineIndex, 4),
        token: CancellationToken.None,
    };

    const block = parseBlocksFromRequestFileContent(content).find(
        ({ name }) => name == AuthBlockName.OAuth2Auth,
    );

    if (!block) {
        throw new Error(
            `Expected to find an 'auth:oauth2' block in content:\n${content}`,
        );
    }

    const completions = getAuthBlockContentCompletions(request, block);
    const completion = completions?.find(
        ({ label }) => label == grantType,
    ) as CompletionItem | undefined;

    if (!completion) {
        throw new Error(
            `Expected a completion for grant type '${grantType}'. Got: ${JSON.stringify(
                completions?.map(({ label }) => label),
            )}`,
        );
    }

    const edits = [completion.textEdit, ...(completion.additionalTextEdits ?? [])]
        .filter((edit) => edit != undefined)
        .map((edit) =>
            completion.insertTextFormat == InsertTextFormat.Snippet
                ? {
                      ...edit,
                      newText: getDefaultTextForSnippet(edit.newText),
                  }
                : edit,
        ) as TextEdit[];

    return applyTextEdits(content, edits);
}

// Editors insert the default (first) choice of a snippet placeholder as plain
// text when the snippet is accepted; mirror that here.
function getDefaultTextForSnippet(snippetText: string) {
    return snippetText
        .replace(/\$\{\d+\|([^}]*)\|}/g, (_match, choices: string) =>
            choices.split(",")[0],
        )
        .replace(/\$\{\d+\}/g, "");
}
