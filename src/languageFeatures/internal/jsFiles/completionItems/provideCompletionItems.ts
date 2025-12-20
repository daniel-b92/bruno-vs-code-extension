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
    getMatchingEnvironmentVariableDefinitions,
} from "../../shared/environmentVariables/getMatchingEnvironmentVariableDefinitions";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { getStringLiteralParameterForGetEnvVarInbuiltFunction } from "../../shared/environmentVariables/getStringLiteralParameterForGetEnvVarInbuiltFunction";
import { mapEnvironmentVariablesToCompletions } from "../../shared/environmentVariables/mapEnvironmentVariablesToCompletions";

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

                const envVariableNameForRequest = getEnvVariableNameForRequest({
                    file: {
                        collection,
                    },
                    baseRequest: { document, position, token },
                    logger,
                });

                return envVariableNameForRequest != undefined
                    ? getResultsForEnvironmentVariable(
                          collection,
                          envVariableNameForRequest,
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

function getEnvVariableNameForRequest(params: {
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

    return getStringLiteralParameterForGetEnvVarInbuiltFunction({
        relevantContent: document.getText(),

        request: params.baseRequest,
        logger,
    });
}

function getResultsForEnvironmentVariable(
    collection: Collection,
    envVariableName: string,
    { token }: LanguageFeatureRequest,
    logger?: OutputChannelLogger,
) {
    const matchingEnvVariableDefinitions =
        getMatchingEnvironmentVariableDefinitions(
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
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(
        "Cancellation requested for completion provider for code blocks.",
    );
}
