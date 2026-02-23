import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    Block,
    BooleanFieldValue,
    EnvVariableNameMatchingMode,
    getBlocksWithoutVariableSupport,
    getDictionaryBlockArrayField,
    getExistingRequestFileTags,
    getMatchingDefinitionsFromEnvFiles,
    getMatchingTextContainingPosition,
    getMaxSequenceForRequests,
    getPossibleMethodBlocks,
    isAuthBlock,
    Logger,
    MetaBlockKey,
    MethodBlockAuth,
    MethodBlockBody,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    Position,
    Range,
    RequestFileBlockName,
    RequestType,
    SettingsBlockKey,
    VariableReferenceType,
} from "@global_shared";
import {
    CompletionItem,
    CompletionItemKind,
    TextEdit,
} from "vscode-languageserver";
import {
    LanguageFeatureBaseRequest,
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../shared";
import { basename, dirname } from "path";
import { NonCodeBlockRequestWithAdditionalData } from "../shared/interfaces";
import { mapEnvVariablesToCompletions } from "./mapEnvVariablesToCompletions";

export async function getCompletionsForNonCodeBlock(
    {
        request: baseRequest,
        file: { blockContainingPosition, allBlocks, collection },
        logger,
    }: NonCodeBlockRequestWithAdditionalData,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironment?: string,
): Promise<CompletionItem[] | undefined> {
    return (
        await getBlockSpecificCompletions(
            itemProvider,
            baseRequest,
            blockContainingPosition,
            collection,
        )
    ).concat(
        collection
            ? getNonBlockSpecificCompletions(
                  baseRequest,
                  {
                      blockContainingPosition,
                      allBlocks,
                      collection,
                  },
                  configuredEnvironment,
                  logger,
              )
            : [],
    );
}

function getNonBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
    file: {
        blockContainingPosition: Block;
        allBlocks: Block[];
        collection: TypedCollection;
    },
    configuredEnvironment?: string,
    logger?: Logger,
) {
    const { blockContainingPosition, allBlocks, collection } = file;
    const { documentHelper, position, token } = request;
    const { line, character } = position;

    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
        )
    ) {
        return [];
    }

    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        documentHelper.getLineByIndex(line),
        /{{(\w|-|_|\.|\d)*/,
    );

    if (!matchingTextResult) {
        return [];
    }

    const { text: matchingText, startChar, endChar } = matchingTextResult;
    // If the position is not after both starting brackets, provided completions would be inserted in an invalid location.
    if (character < startChar + 2 || character > endChar) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }
    const variable = {
        name: matchingText.substring(2),
        start: new Position(line, startChar + 2),
        end: new Position(line, endChar),
    };

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variable.name,
            EnvVariableNameMatchingMode.Ignore,
            configuredEnvironment,
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
                variable,
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
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    blockContainingPosition: Block,
    collection?: TypedCollection,
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
    itemProvider: TypedCollectionItemProvider,
    request: LanguageFeatureBaseRequest,
    metaBlock: Block,
    collection?: TypedCollection,
) {
    const { documentHelper, filePath, position } = request;

    const getSequenceFieldCompletion = async () => {
        const { line } = position;
        const currentText = documentHelper.getLineByIndex(line);
        const sequencePattern = new RegExp(
            `^\\s*${MetaBlockKey.Sequence}:.*$`,
            "m",
        );

        if (!currentText.match(sequencePattern)) {
            return [];
        }

        const suggestedSequence =
            ((await getMaxSequenceForRequests(
                itemProvider,
                dirname(filePath),
            )) ?? 0) + 1;

        const completion: CompletionItem = {
            label: suggestedSequence.toString(),
            textEdit: {
                newText: ` ${suggestedSequence}`,
                range: new Range(
                    new Position(line, currentText.indexOf(":") + 1),
                    new Position(line, currentText.length),
                ),
            },
        };

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
            .some((range) => range.contains(position));

        if (!isWithinValues || !collection) {
            return [];
        }

        const tagsByCollections = getExistingRequestFileTags(itemProvider, {
            collection,
            pathToIgnore: filePath,
        });

        return tagsByCollections
            .filter(
                // Filter out already defined tags in the same document.
                ({ tag }) =>
                    tagsField.values.every(({ content: c }) => c != tag),
            )
            .map(
                ({
                    tag,
                    pathsInOwnCollection: inOwnCollection,
                    inOtherCollections,
                }) => {
                    const alreadyUsedInOwnCollection =
                        inOwnCollection.length > 0;

                    return {
                        label: tag,
                        labelDetails: {
                            description: alreadyUsedInOwnCollection
                                ? "Used in own collection"
                                : inOtherCollections.length == 1
                                  ? `Used in collection '${basename(inOtherCollections[0].collection.getRootDirectory())}'`
                                  : `Used in ${inOtherCollections.length} other collections`,
                        },
                        sortText: alreadyUsedInOwnCollection
                            ? `a_${tag}`
                            : `b_${tag}`,
                        kind: CompletionItemKind.Constant,
                    };
                },
            );
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

function getMethodBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
) {
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

function getAuthBlockSpecificCompletions(request: LanguageFeatureBaseRequest) {
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

function getSettingsBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.EncodeUrl,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.FollowRedirects,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.Timeout,
                ),
                choices: ["inherit"],
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
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
): CompletionItem[] {
    const currentText = documentHelper.getLineByIndex(line);

    return params.flatMap(({ linePattern, choices }) => {
        if (!currentText.match(linePattern)) {
            return [];
        }

        return choices.map((choice) => ({
            label: choice,
            textEdit: getTextEditForDictionaryBlockSimpleValue(
                line,
                currentText,
                choice,
            ),
        }));
    });
}

function getTextEditForDictionaryBlockSimpleValue(
    lineIndex: number,
    textInLine: string,
    value: string,
): TextEdit | undefined {
    return textInLine.includes(":")
        ? {
              newText: ` ${value}`,
              range: new Range(
                  new Position(lineIndex, textInLine.indexOf(":") + 1),
                  new Position(lineIndex, textInLine.length),
              ),
          }
        : undefined;
}

function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:.*$`, "m");
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for bruno language.`,
    );
}
