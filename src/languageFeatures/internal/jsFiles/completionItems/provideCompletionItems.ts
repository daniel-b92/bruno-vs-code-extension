import { languages } from "vscode";
import {
    CollectionItemProvider,
    OutputChannelLogger,
    Collection,
    getConfiguredTestEnvironment,
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctions,
} from "../../../../shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import {
    EnvVariableNameMatchingMode,
    getMatchingDefinitionsFromEnvFiles,
} from "../../shared/environmentVariables/getMatchingDefinitionsFromEnvFiles";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { mapEnvVariablesToCompletions } from "../../shared/environmentVariables/mapEnvVariablesToCompletions";

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
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        request: params.baseRequest,
        logger,
    });

    return found
        ? {
              ...found,
              type: getInbuiltFunctions()[found.inbuiltFunction.functionName]
                  .type,
          }
        : undefined;
}

function getResultsForEnvironmentVariable(
    envVariableName: string,
    additionalData: {
        collection: Collection;
        functionType: VariableReferenceType;
    },
    { position, token }: LanguageFeatureRequest,
    logger?: OutputChannelLogger,
) {
    const { collection, functionType } = additionalData;

    const matchingEnvVariableDefinitions = getMatchingDefinitionsFromEnvFiles(
        collection,
        envVariableName,
        EnvVariableNameMatchingMode.Ignore,
        getConfiguredTestEnvironment(),
    );

    if (matchingEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapEnvVariablesToCompletions(
        matchingEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            functionType,
            requestPosition: position,
        },
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(
        "Cancellation requested for completion provider for code blocks.",
    );
}
