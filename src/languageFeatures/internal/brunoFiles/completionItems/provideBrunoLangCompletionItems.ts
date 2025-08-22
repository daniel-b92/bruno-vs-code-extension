import { CompletionItem, Disposable, languages } from "vscode";
import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    CollectionItemProvider,
    getMaxSequenceForRequests,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    OutputChannelLogger,
    RequestType,
    SettingsBlockKey,
} from "../../../../shared";
import { dirname } from "path";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";

export function provideBrunoLangCompletionItems(
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return getCompletionItemsForFieldsInMetaBlock(itemProvider, logger)
        .concat([getCompletionItemsForFieldsInMethodBlock(logger)])
        .concat([getCompletionItemsForFieldsInAuthBlock(logger)])
        .concat(getCompletionItemsForFieldsInSettingsBlock(logger));
}

function getCompletionItemsForFieldsInMetaBlock(
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    const result: Disposable[] = [];

    result.push(
        registerFixedCompletionItems(
            [
                {
                    linePattern: getLinePatternForDictionaryField(
                        MetaBlockKey.Type,
                    ),
                    choices: Object.values(RequestType),
                },
            ],
            logger,
        ),
    );

    result.push(
        languages.registerCompletionItemProvider(
            getRequestFileDocumentSelector(),
            {
                async provideCompletionItems(document, position, token) {
                    if (token.isCancellationRequested) {
                        logger?.debug(
                            `Cancellation requested for completion provider for bruno language.`,
                        );
                        return undefined;
                    }

                    const currentText = document.lineAt(position.line).text;
                    const sequencePattern = new RegExp(
                        `^\\s*${MetaBlockKey.Sequence}:\\s*$`,
                        "m",
                    );

                    if (currentText.match(sequencePattern)) {
                        return {
                            items: [
                                new CompletionItem(
                                    `${currentText.endsWith(" ") ? "" : " "}${
                                        (await getMaxSequenceForRequests(
                                            itemProvider,
                                            dirname(document.uri.fsPath),
                                        )) + 1
                                    }`,
                                ),
                            ],
                        };
                    } else {
                        return undefined;
                    }
                },
            },
            ...getTriggerChars(),
        ),
    );

    return result;
}

function getCompletionItemsForFieldsInMethodBlock(
    logger?: OutputChannelLogger,
) {
    return registerFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Body,
                ),
                choices: Object.values(MethodBlockBody),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Auth,
                ),
                choices: Object.values(MethodBlockAuth),
            },
        ],
        logger,
    );
}

function getCompletionItemsForFieldsInAuthBlock(logger?: OutputChannelLogger) {
    return registerFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    ApiKeyAuthBlockKey.Placement,
                ),
                choices: Object.values(ApiKeyAuthBlockPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement,
                ),
                choices: Object.values(OAuth2BlockCredentialsPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.Pkce,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement,
                ),
                choices: Object.values(OAuth2BlockTokenPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken,
                ),
                choices: Object.values(BooleanFieldValue),
            },
        ],
        logger,
    );
}

function getCompletionItemsForFieldsInSettingsBlock(
    logger?: OutputChannelLogger,
) {
    return registerFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.EncodeUrl,
                ),
                choices: Object.values(BooleanFieldValue),
            },
        ],
        logger,
    );
}

function registerFixedCompletionItems(
    params: {
        linePattern: RegExp;
        choices: string[];
    }[],
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(document, position, token) {
                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for completion provider for bruno language.`,
                    );
                    return undefined;
                }

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
                                        }${choice}`,
                                    ),
                            ),
                        );
                    }
                }

                return items;
            },
        },
        ...getTriggerChars(),
    );
}

function getTriggerChars() {
    return [":", " "];
}

function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:\\s*$`);
}
