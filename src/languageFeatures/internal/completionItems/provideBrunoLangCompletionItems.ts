import {
    commands,
    CompletionItem,
    CompletionList,
    languages,
    Uri,
} from "vscode";
import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    CollectionItemProvider,
    getMaxSequenceForRequests,
    mapRange,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    parseBruFile,
    RequestFileBlockName,
    RequestType,
    TextDocumentHelper,
} from "../../../shared";
import { dirname } from "path";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getVirtualJsFileName } from "../shared/getVirtualJsFileName";

export function provideBrunoLangCompletionItems(
    collectionItemProvider: CollectionItemProvider
) {
    getCompletionItemsForFieldsInMetaBlock();
    getCompletionItemsForFieldsInMethodBlock();
    getCompletionItemsForFieldsInAuthBlock();
    getCompletionsForTextBlocks(collectionItemProvider);
}

function getCompletionsForTextBlocks(
    collectionItemProvider: CollectionItemProvider
) {
    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName
                    );

                if (!collection) {
                    return [];
                }

                const { blocks } = parseBruFile(
                    new TextDocumentHelper(document.getText())
                );

                const blocksToCheck = blocks.filter(({ name }) =>
                    (
                        [
                            RequestFileBlockName.PreRequestScript,
                            RequestFileBlockName.PostResponseScript,
                            RequestFileBlockName.Tests,
                        ] as string[]
                    ).includes(name)
                );

                if (
                    blocksToCheck.some(({ contentRange }) =>
                        mapRange(contentRange).contains(position)
                    )
                ) {
                    const virtualJsFileUri = Uri.file(
                        getVirtualJsFileName(
                            collection.getRootDirectory(),
                            document.fileName
                        )
                    );

                    // ToDo: Find a way to avoid causing Debug warnings when requesting completion items that are not opened in VS Code.
                    // Currently it probably only works so well by chance.
                    const result =
                        await commands.executeCommand<CompletionList>(
                            "vscode.executeCompletionItemProvider",
                            virtualJsFileUri,
                            position
                        );

                    return result;
                } else {
                    return undefined;
                }
            },
        },
        ".",
        " ",
        "(",
        "/"
    );
}

function getCompletionItemsForFieldsInMetaBlock() {
    registerFixedCompletionItems([
        {
            linePattern: getLinePatternForDictionaryField(MetaBlockKey.Type),
            choices: Object.values(RequestType),
        },
    ]);

    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;
                const sequencePattern = new RegExp(
                    `^\\s*${MetaBlockKey.Sequence}:\\s*$`,
                    "m"
                );

                if (currentText.match(sequencePattern)) {
                    return {
                        items: [
                            new CompletionItem(
                                `${currentText.endsWith(" ") ? "" : " "}${
                                    getMaxSequenceForRequests(
                                        dirname(document.uri.fsPath)
                                    ) + 1
                                }`
                            ),
                        ],
                    };
                } else {
                    return undefined;
                }
            },
        },
        ...getTriggerChars()
    );
}

function getCompletionItemsForFieldsInMethodBlock() {
    registerFixedCompletionItems([
        {
            linePattern: getLinePatternForDictionaryField(MethodBlockKey.Body),
            choices: Object.values(MethodBlockBody),
        },
        {
            linePattern: getLinePatternForDictionaryField(MethodBlockKey.Auth),
            choices: Object.values(MethodBlockAuth),
        },
    ]);
}

function getCompletionItemsForFieldsInAuthBlock() {
    registerFixedCompletionItems([
        {
            linePattern: getLinePatternForDictionaryField(
                ApiKeyAuthBlockKey.Placement
            ),
            choices: Object.values(ApiKeyAuthBlockPlacementValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement
            ),
            choices: Object.values(OAuth2BlockCredentialsPlacementValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.Pkce
            ),
            choices: Object.values(BooleanFieldValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement
            ),
            choices: Object.values(OAuth2BlockTokenPlacementValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken
            ),
            choices: Object.values(BooleanFieldValue),
        },
        {
            linePattern: getLinePatternForDictionaryField(
                OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken
            ),
            choices: Object.values(BooleanFieldValue),
        },
    ]);
}

function registerFixedCompletionItems(
    params: {
        linePattern: RegExp;
        choices: string[];
    }[]
) {
    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(document, position) {
                const currentText = document.lineAt(position.line).text;

                const items: CompletionItem[] = [];

                for (const { linePattern, choices } of params) {
                    if (currentText.match(linePattern)) {
                        items.push(
                            ...choices.map(
                                (choice) =>
                                    new CompletionItem(
                                        `${
                                            currentText.endsWith(" ") ? "" : " "
                                        }${choice}`
                                    )
                            )
                        );
                    }
                }

                return items;
            },
        },
        ...getTriggerChars()
    );
}

function getTriggerChars() {
    return [":", " "];
}

function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:\\s*$`);
}
