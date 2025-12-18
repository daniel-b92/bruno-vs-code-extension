import { CompletionItem, languages } from "vscode";
import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    Block,
    BooleanFieldValue,
    Collection,
    CollectionItemProvider,
    getConfiguredTestEnvironment,
    getMatchingTextContainingPosition,
    getMaxSequenceForRequests,
    getPossibleMethodBlocks,
    isAuthBlock,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    RequestType,
    SettingsBlockKey,
    TextDocumentHelper,
} from "../../../../shared";
import { dirname } from "path";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getNonCodeBlocksWithoutVariableSupport } from "../shared/nonCodeBlockUtils/getNonCodeBlocksWithoutVariableSupport";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import {
    EnvVariableNameMatchingMode,
    getMatchingEnvironmentVariableDefinitions,
} from "../../shared/environmentVariables/getMatchingEnvironmentVariableDefinitions";
import { mapEnvironmentVariablesToCompletions } from "./util/mapEnvironmentVariablesToCompletions";

export function provideBrunoLangCompletionItems(
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position, token) {
                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for completion provider for bruno language.`,
                    );
                    return undefined;
                }
                const request: LanguageFeatureRequest = {
                    document,
                    position,
                    token,
                };

                const { blocks: parsedBlocks } = parseBruFile(
                    new TextDocumentHelper(document.getText()),
                );

                const blockContainingPosition = parsedBlocks.find(
                    ({ contentRange }) =>
                        mapToVsCodeRange(contentRange).contains(position),
                );

                if (!blockContainingPosition) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for completion provider for bruno language.`,
                    );
                    return undefined;
                }
                const collection = itemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );

                return (
                    await getBlockSpecificCompletions(
                        itemProvider,
                        request,
                        blockContainingPosition.name,
                    )
                ).concat(
                    collection
                        ? getNonBlockSpecificCompletions(request, {
                              block: blockContainingPosition,
                              collection,
                          })
                        : [],
                );
            },
        },
        ...getTriggerChars(),
    );
}

function getNonBlockSpecificCompletions(
    request: LanguageFeatureRequest,
    file: { block: Block; collection: Collection },
    logger?: OutputChannelLogger,
) {
    const { block, collection } = file;
    const { document, position, token } = request;
    if (
        (getNonCodeBlocksWithoutVariableSupport() as string[]).includes(
            block.name,
        )
    ) {
        return [];
    }

    const matchingText = getMatchingTextContainingPosition(
        document,
        mapFromVsCodePosition(position),
        /{{\w*/,
    );

    if (!matchingText) {
        return [];
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return [];
    }

    const matchingEnvVariableDefinitions =
        getMatchingEnvironmentVariableDefinitions(
            collection,
            matchingText.substring(2),
            EnvVariableNameMatchingMode.Substring,
            getConfiguredTestEnvironment(),
        );

    if (matchingEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return [];
    }

    return mapEnvironmentVariablesToCompletions(
        matchingEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
    );
}

async function getBlockSpecificCompletions(
    itemProvider: CollectionItemProvider,
    request: LanguageFeatureRequest,
    blockName: string,
) {
    if (blockName == RequestFileBlockName.Meta) {
        return await getMetaBlockSpecificCompletions(itemProvider, request);
    }
    if ((getPossibleMethodBlocks() as string[]).includes(blockName)) {
        return getMethodBlockSpecificCompletions(request);
    }
    if (isAuthBlock(blockName)) {
        return getAuthBlockSpecificCompletions(request);
    }
    if (blockName == RequestFileBlockName.Settings) {
        return getSettingsBlockSpecificCompletions(request);
    }
    return [];
}

async function getMetaBlockSpecificCompletions(
    itemProvider: CollectionItemProvider,
    request: LanguageFeatureRequest,
) {
    const { document, position } = request;

    const getSequenceFieldCompletions = async () => {
        const currentText = document.lineAt(position.line).text;
        const sequencePattern = new RegExp(
            `^\\s*${MetaBlockKey.Sequence}:\\s*$`,
            "m",
        );

        if (currentText.match(sequencePattern)) {
            return [
                new CompletionItem(
                    `${currentText.endsWith(" ") ? "" : " "}${
                        ((await getMaxSequenceForRequests(
                            itemProvider,
                            dirname(document.uri.fsPath),
                        )) ?? 0) + 1
                    }`,
                ),
            ];
        }
        return [];
    };

    const typeFieldCompletions = getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MetaBlockKey.Type,
                ),
                choices: Object.values(RequestType),
            },
        ],
        request,
    );

    return (await getSequenceFieldCompletions()).concat(typeFieldCompletions);
}

function getMethodBlockSpecificCompletions(request: LanguageFeatureRequest) {
    return getFixedCompletionItems(
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
        request,
    );
}

function getAuthBlockSpecificCompletions(request: LanguageFeatureRequest) {
    return getFixedCompletionItems(
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
        request,
    );
}

function getSettingsBlockSpecificCompletions(request: LanguageFeatureRequest) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.EncodeUrl,
                ),
                choices: Object.values(BooleanFieldValue),
            },
        ],
        request,
    );
}

function getFixedCompletionItems(
    params: {
        linePattern: RegExp;
        choices: string[];
    }[],
    { document, position }: LanguageFeatureRequest,
) {
    const currentText = document.lineAt(position.line).text;

    const items: CompletionItem[] = [];

    for (const { linePattern, choices } of params) {
        if (currentText.match(linePattern)) {
            items.push(
                ...choices.map(
                    (choice) =>
                        new CompletionItem(
                            `${currentText.endsWith(" ") ? "" : " "}${choice}`,
                        ),
                ),
            );
        }
    }

    return items;
}

function getTriggerChars() {
    return [":", " ", "{"];
}

function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:\\s*$`);
}
