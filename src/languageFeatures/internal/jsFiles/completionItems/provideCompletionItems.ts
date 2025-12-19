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
import { parseEnvVariableNameFromTsSourceFile } from "../../shared/environmentVariables/parseEnvVariableNameFromTsSourceFile";
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
        baseRequest: { document, position, token },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const fullParameter = parseEnvVariableNameFromTsSourceFile(
        {
            relevantContent: document.getText(),
        },
        params.baseRequest,
        logger,
    );

    if (!fullParameter) {
        return undefined;
    }

    const { text, start, end } = fullParameter;
    const startsWithQuotes = /^("|'|`)/.test(text);
    const endsWithQuotes = /("|'|`)$/.test(text);

    return startsWithQuotes &&
        endsWithQuotes &&
        position.compareTo(start) > 0 &&
        position.compareTo(end) < 0
        ? text.substring(1, text.length - 1)
        : undefined;
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
