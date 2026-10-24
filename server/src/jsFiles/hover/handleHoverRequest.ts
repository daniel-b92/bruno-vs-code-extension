import { Logger } from "@global_shared";
import {
    getHoverContentForStaticEnvVariables,
    JsFileInContextRootRequest,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
} from "../../shared";
import { getEnvVariableRelatedFunctionForRequest } from "../shared/getEnvVariableRelatedFunctionForRequest";
import { getMatchingEnvDefinitionsForCollections } from "../shared/getMatchingEnvDefinitionsForCollections";
import { Hover } from "vscode-languageserver";

export function handleHoverRequest({
    baseRequest,
    collection,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo) {
    return getHover(
        baseRequest,
        [{ collection, configuredEnvironmentName }],
        { showCollectionNames: false },
        logger,
    );
}

/** Handles JS files that are not part of a collection, but within `additionalContextRoots` of at least one collection. */
export async function handleHoverRequestForJsFileInContextRoot({
    baseRequest,
    collections,
    logger,
}: JsFileInContextRootRequest) {
    return getHover(
        baseRequest,
        collections,
        { showCollectionNames: true },
        logger,
    );
}

function getHover(
    baseRequest: LanguageFeatureBaseRequest,
    collections: JsFileInContextRootRequest["collections"],
    { showCollectionNames }: { showCollectionNames: boolean },
    logger?: Logger,
): Hover | undefined {
    const envVariableRelatedFunction =
        getEnvVariableRelatedFunctionForRequest(baseRequest);

    if (envVariableRelatedFunction == undefined) {
        return undefined;
    }
    if (baseRequest.token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const content = getHoverContentForStaticEnvVariables(
        getMatchingEnvDefinitionsForCollections(
            collections,
            envVariableRelatedFunction.variable.name,
            showCollectionNames,
        ),
    );

    return content
        ? { contents: { kind: "markdown", value: content } }
        : undefined;
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for hover provider for JS files.`);
}
