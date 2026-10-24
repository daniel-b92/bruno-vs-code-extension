import { getMatchingDefinitionsFromEnvFiles, Logger } from "@global_shared";
import {
    JsFileInContextRootRequest,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    mapStaticEnvVariablesFromMultipleCollectionsToCompletions,
} from "../../shared";
import { getEnvVariableRelatedFunctionForRequest } from "../shared/getEnvVariableRelatedFunctionForRequest";
import { basename } from "path";
import { CompletionItem } from "vscode-languageserver";

export async function handleCompletionRequest({
    baseRequest,
    collection,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo): Promise<
    CompletionItem[] | undefined
> {
    return getCompletionsForCollections(
        baseRequest,
        [{ collection, configuredEnvironmentName }],
        logger,
    );
}

/** Handles JS files that are not part of a collection, but within `additionalContextRoots` of at least one collection. */
export async function handleCompletionRequestForJsFileInContextRoot({
    baseRequest,
    collections,
    logger,
}: JsFileInContextRootRequest): Promise<CompletionItem[] | undefined> {
    return getCompletionsForCollections(baseRequest, collections, logger);
}

/** Creates exactly one completion item per variable name, regardless of how many environments or collections define it. */
function getCompletionsForCollections(
    baseRequest: LanguageFeatureBaseRequest,
    collections: JsFileInContextRootRequest["collections"],
    logger?: Logger,
): CompletionItem[] | undefined {
    const { token } = baseRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableRelatedFunction =
        getEnvVariableRelatedFunctionForRequest(baseRequest);

    if (envVariableRelatedFunction == undefined) {
        return undefined;
    }

    const matches = collections.flatMap(
        ({ collection, configuredEnvironmentName }) =>
            getMatchingDefinitionsFromEnvFiles(
                collection,
                undefined,
                configuredEnvironmentName,
            ).map((match) => ({
                ...match,
                collectionName: basename(collection.getRootDirectory()),
            })),
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapStaticEnvVariablesFromMultipleCollectionsToCompletions(
        envVariableRelatedFunction.type,
        matches,
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested for completion provider for JS files.",
    );
}
