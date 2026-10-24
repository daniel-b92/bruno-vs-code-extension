import { Logger, getMatchingDefinitionsFromEnvFiles } from "@global_shared";
import {
    getHoverContentForStaticEnvVariables,
    JsFileInContextRootRequest,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    TypedCollection,
} from "../../shared";
import { getEnvVariableRelatedFunctionForRequest } from "../shared/getEnvVariableRelatedFunctionForRequest";
import { basename } from "path";
import { Hover } from "vscode-languageserver";

export function handleHoverRequest({
    baseRequest,
    collection,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo) {
    return getHover({
        file: { collection },
        baseRequest,
        logger,
        configuredEnvironmentName,
    });
}

/** Handles JS files that are not part of a collection, but within `additionalContextRoots` of at least one collection. */
export async function handleHoverRequestForJsFileInContextRoot({
    baseRequest,
    collections,
    logger,
}: JsFileInContextRootRequest): Promise<Hover | undefined> {
    const { token } = baseRequest;

    const envVariableRelatedFunction =
        getEnvVariableRelatedFunctionForRequest(baseRequest);

    if (envVariableRelatedFunction == undefined) {
        return undefined;
    }
    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const matches = collections
        .map(({ collection, configuredEnvironmentName }) => ({
            collectionName: basename(collection.getRootDirectory()),
            matches: getMatchingDefinitionsFromEnvFiles(
                collection,
                envVariableRelatedFunction.variable.name,
                configuredEnvironmentName,
            ),
        }))
        .sort((a, b) => a.collectionName.localeCompare(b.collectionName))
        .flatMap(({ collectionName, matches }) =>
            matches.map((match) => ({ ...match, collectionName })),
        );

    const content = getHoverContentForStaticEnvVariables(matches);

    return content
        ? { contents: { kind: "markdown", value: content } }
        : undefined;
}

async function getHover(params: {
    file: { collection: TypedCollection };
    baseRequest: LanguageFeatureBaseRequest;
    logger?: Logger;
    configuredEnvironmentName?: string;
}): Promise<Hover | undefined> {
    const {
        file: { collection },
        baseRequest: { token },
        logger,
        configuredEnvironmentName,
    } = params;

    const envVariableRelatedFunction = getEnvVariableRelatedFunctionForRequest(
        params.baseRequest,
    );

    if (envVariableRelatedFunction == undefined) {
        return undefined;
    }
    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const {
        variable: { name: variableName },
    } = envVariableRelatedFunction;

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variableName,
            configuredEnvironmentName,
        );

    const content = getHoverContentForStaticEnvVariables(
        matchingStaticEnvVariableDefinitions,
    );

    return content
        ? { contents: { kind: "markdown", value: content } }
        : undefined;
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for hover provider for JS files.`);
}
