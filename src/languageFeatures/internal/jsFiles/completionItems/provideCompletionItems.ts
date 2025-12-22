import { languages } from "vscode";
import {
    CollectionItemProvider,
    OutputChannelLogger,
    Collection,
    getConfiguredTestEnvironment,
} from "../../../../shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import {
    EnvVariableNameMatchingMode,
    getMatchingEnvironmentVariableDefinitionsFromEnvFiles,
} from "../../shared/environmentVariables/getMatchingEnvironmentVariableDefinitionsFromEnvFiles";
import {
    EnvVariableFunctionType,
    LanguageFeatureRequest,
} from "../../shared/interfaces";
import { getFirstParameterForInbuiltFunctionIfStringLiteral } from "../../shared/environmentVariables/getFirstParameterForInbuiltFunctionIfStringLiteral";
import { mapEnvironmentVariablesToCompletions } from "../../shared/environmentVariables/mapEnvironmentVariablesToCompletions";
import {
    getInbuiltFunctionIdentifiersForEnvVariables,
    getInbuiltFunctionsForEnvironmentVariables,
} from "../../shared/environmentVariables/getInbuiltFunctionsForEnvironmentVariables";

export function provideCompletionItems(
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getJsFileDocumentSelector(),
        {
            async provideCompletionItems(document, position, token) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    );

                if (!collection) {
                    return [];
                }

                if (token.isCancellationRequested) {
                    addLogEntryForCancellation(logger);
                    return undefined;
                }

                const envVariableRelatedFunction =
                    getEnvVariableRelatedFunctionForRequest({
                        file: {
                            collection,
                        },
                        baseRequest: { document, position, token },
                        logger,
                    });

                return envVariableRelatedFunction != undefined
                    ? getResultsForEnvironmentVariable(
                          envVariableRelatedFunction.variableName,
                          {
                              collection,
                              functionType: envVariableRelatedFunction.type,
                          },
                          { document, position, token },
                          logger,
                      )
                    : undefined;
            },
        },
        ".",
        "/",
        '"',
        "'",
        "`",
    );
}

function getEnvVariableRelatedFunctionForRequest(params: {
    file: { collection: Collection };
    baseRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        baseRequest: { document, token },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const found = getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: document.getText(),
        functionsToSearchFor: getInbuiltFunctionIdentifiersForEnvVariables(),
        request: params.baseRequest,
        logger,
    });

    return found
        ? {
              ...found,
              type: getInbuiltFunctionsForEnvironmentVariables()[
                  found.inbuiltFunction.functionName
              ].type,
          }
        : undefined;
}

function getResultsForEnvironmentVariable(
    envVariableName: string,
    additionalData: {
        collection: Collection;
        functionType: EnvVariableFunctionType;
    },
    { token }: LanguageFeatureRequest,
    logger?: OutputChannelLogger,
) {
    const { collection, functionType } = additionalData;

    const matchingEnvVariableDefinitions =
        getMatchingEnvironmentVariableDefinitionsFromEnvFiles(
            collection,
            envVariableName,
            EnvVariableNameMatchingMode.Substring,
            getConfiguredTestEnvironment(),
        );

    if (matchingEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
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
        functionType,
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(
        "Cancellation requested for completion provider for code blocks.",
    );
}
