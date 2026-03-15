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
import { BlockRequestWithAdditionalData } from "../shared/interfaces";
import { mapEnvVariablesToCompletions } from "./mapEnvVariablesToCompletions";
import { getDynamicVariableReferences } from "../shared/getDynamicVariableReferences";

export async function getCompletionsForNonCodeBlock(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    itemProvider: TypedCollectionItemProvider,
    configuredEnvironment?: string,
): Promise<CompletionItem[] | undefined> {
    const {
        request: baseRequest,
        file: { blockContainingPosition, collection },
    } = fullRequest;

    return (
        await getBlockSpecificCompletions(
            itemProvider,
            baseRequest,
            blockContainingPosition,
            collection,
        )
    ).concat(
        collection
            ? getNonBlockSpecificCompletions(fullRequest, configuredEnvironment)
            : [],
    );
}

function getNonBlockSpecificCompletions(
    fullRequest: BlockRequestWithAdditionalData<Block>,
    configuredEnvironment?: string,
) {
    const {
        request,
        file: { blockContainingPosition, collection },
        logger,
    } = fullRequest;
    const { documentHelper, position, token } = request;
    const { line } = position;
    // In non-code blocks, variables cannot be set.
    const functionType = VariableReferenceType.Read;
    const lineContent = documentHelper.getLineByIndex(line);

    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
        )
    ) {
        return [];
    }
    const variableParsingResult = getVariable(request, lineContent, logger);
    if (!variableParsingResult) {
        return [];
    }

    const { variable, toAppendOnInsertion } = variableParsingResult;

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

    const dynamicVariableReferences = getDynamicVariableReferences(
        fullRequest,
        functionType,
    );

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
        dynamicVariableReferences,
        {
            collection,
            variable,
            functionType,
            requestPosition: position,
            token,
        },
        toAppendOnInsertion,
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

function getVariable(
    { position, token }: LanguageFeatureBaseRequest,
    lineContent: string,
    logger?: Logger,
) {
    const { character, line } = position;
    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        lineContent,
        /{{(\w|-|_|\.|\d)*/,
    );

    if (!matchingTextResult) {
        return undefined;
    }

    const { text: matchingText, startChar, endChar } = matchingTextResult;
    // If the position is not after both starting brackets, provided completions would be inserted in an invalid location.
    if (character < startChar + 2 || character > endChar) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return {
        variable: {
            name: matchingText.substring(2),
            start: new Position(line, startChar + 2),
            end: new Position(line, endChar),
        },
        toAppendOnInsertion: !lineContent.substring(endChar).startsWith("}")
            ? "}}"
            : "",
    };
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
