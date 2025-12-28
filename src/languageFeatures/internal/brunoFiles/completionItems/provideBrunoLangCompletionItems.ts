import { CompletionItem, CompletionItemKind, languages } from "vscode";
import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    Block,
    BooleanFieldValue,
    Collection,
    CollectionItemProvider,
    getBlocksWithoutVariableSupport,
    getConfiguredTestEnvironment,
    getDictionaryBlockArrayField,
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
    VariableReferenceType,
} from "../../../../shared";
import { basename, dirname } from "path";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import {
    EnvVariableNameMatchingMode,
    getMatchingDefinitionsFromEnvFiles,
} from "../../shared/environmentVariables/getMatchingDefinitionsFromEnvFiles";
import { mapEnvVariablesToCompletions } from "../../shared/environmentVariables/mapEnvVariablesToCompletions";
import { getExistingRequestFileTags } from "../shared/getExistingRequestFileTags";

export function provideBrunoLangCompletionItems(
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position, token) {
                if (token.isCancellationRequested) {
                    addLogEntryForCancellation(logger);
                    return undefined;
                }
                const request: LanguageFeatureRequest = {
                    document,
                    position,
                    token,
                };

                const { blocks: allBlocks } = parseBruFile(
                    new TextDocumentHelper(document.getText()),
                );

                const blockContainingPosition = allBlocks.find(
                    ({ contentRange }) =>
                        mapToVsCodeRange(contentRange).contains(position),
                );

                if (!blockContainingPosition) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    addLogEntryForCancellation(logger);
                    return undefined;
                }
                const collection = itemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );

                return (
                    await getBlockSpecificCompletions(
                        itemProvider,
                        request,
                        blockContainingPosition,
                        collection,
                    )
                ).concat(
                    collection
                        ? getNonBlockSpecificCompletions(request, {
                              blockContainingPosition,
                              allBlocks,
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
    file: {
        blockContainingPosition: Block;
        allBlocks: Block[];
        collection: Collection;
    },
    logger?: OutputChannelLogger,
) {
    const { blockContainingPosition, allBlocks, collection } = file;
    const { document, position, token } = request;
    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
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
        addLogEntryForCancellation(logger);
        return [];
    }
    const variableName = matchingText.substring(2);

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variableName,
            EnvVariableNameMatchingMode.Ignore,
            getConfiguredTestEnvironment(),
        );

    if (matchingStaticEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapEnvVariablesToCompletions(
        matchingStaticEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            requestData: {
                collection,
                variableName,
                functionType: VariableReferenceType.Read, // In non-code blocks, variables can not be set.
                requestPosition: position,
                token,
            },
            bruFileSpecificData: { blockContainingPosition, allBlocks },
            logger,
        },
    );
}

async function getBlockSpecificCompletions(
    itemProvider: CollectionItemProvider,
    request: LanguageFeatureRequest,
    blockContainingPosition: Block,
    collection?: Collection,
) {
    const { name: blockName } = blockContainingPosition;

    if (blockName == RequestFileBlockName.Meta) {
        return await getMetaBlockSpecificCompletions(
            itemProvider,
            request,
            blockContainingPosition,
            collection,
        );
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
    metaBlock: Block,
    collection?: Collection,
) {
    const { document, position } = request;

    const getSequenceFieldCompletion = async () => {
        const currentText = document.lineAt(position.line).text;
        const sequencePattern = new RegExp(
            `^\\s*${MetaBlockKey.Sequence}:\\s*\\d*`,
            "m",
        );

        if (!currentText.match(sequencePattern)) {
            return [];
        }

        const suggestedSequence =
            ((await getMaxSequenceForRequests(
                itemProvider,
                dirname(document.fileName),
            )) ?? 0) + 1;

        const completion = new CompletionItem(suggestedSequence.toString());
        completion.insertText = `${currentText.includes(": ") ? "" : " "}${suggestedSequence}`;

        return [completion];
    };

    const getTagsFieldCompletions = () => {
        const tagsField = getDictionaryBlockArrayField(
            metaBlock,
            MetaBlockKey.Tags,
        );
        if (!tagsField) {
            return [];
        }

        const isWithinValues = tagsField.plainTextWithinValues
            .map(({ range }) => range)
            .concat(tagsField.values.map(({ range }) => range))
            .some((range) => mapToVsCodeRange(range).contains(position));

        if (!isWithinValues || !collection) {
            return [];
        }

        const tagsByCollections = getExistingRequestFileTags(itemProvider, {
            collection,
            pathToIgnore: document.fileName,
        });

        return tagsByCollections
            .filter(
                // Filter out already defined tags in the same document.
                ({ tag }) =>
                    tagsField.values.every(({ content: c }) => c != tag),
            )
            .map(({ tag, inOwnCollection, inOtherCollections }) => {
                const completion = new CompletionItem({
                    label: tag,
                    description: inOwnCollection
                        ? "own collection"
                        : inOtherCollections.length == 1
                          ? `From collection '${basename(inOtherCollections[0].getRootDirectory())}'`
                          : `From ${inOtherCollections.length} other collections`,
                });
                completion.sortText = inOwnCollection ? `a_${tag}` : `b_${tag}`;
                completion.kind = CompletionItemKind.Constant;
                return completion;
            });
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

    return (await getSequenceFieldCompletion()).concat(
        typeFieldCompletions,
        getTagsFieldCompletions(),
    );
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

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(
        `Cancellation requested for completion provider for bruno language.`,
    );
}
