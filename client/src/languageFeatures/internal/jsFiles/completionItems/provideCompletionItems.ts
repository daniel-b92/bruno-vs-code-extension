import { languages } from "vscode";
import {
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    Position,
    getInbuiltFunctionType,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
} from "@global_shared";
import {
    OutputChannelLogger,
    getConfiguredTestEnvironment,
    mapFromVsCodePosition,
    TypedCollectionItemProvider,
    TypedCollection,
} from "@shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { mapEnvVariablesToCompletions } from "../../shared/environmentVariables/mapEnvVariablesToCompletions";

export function provideCompletionItems(
    collectionItemProvider: TypedCollectionItemProvider,
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
    file: { collection: TypedCollection };
    baseRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        baseRequest: { document, token, position },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const found = getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: {
            asString: document.getText(),
            startPosition: new Position(0, 0),
        },
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        position: mapFromVsCodePosition(position),
    });

    return found
        ? {
              ...found,
              type: getInbuiltFunctionType(found.inbuiltFunction),
          }
        : undefined;
}

function getResultsForEnvironmentVariable(
    envVariableName: string,
    additionalData: {
        collection: TypedCollection;
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
            requestData: {
                collection,
                variableName: envVariableName,
                functionType,
                requestPosition: position,
                token,
            },
            logger,
        },
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(
        "Cancellation requested for completion provider for code blocks.",
    );
}
