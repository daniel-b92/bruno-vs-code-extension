import {
    VariableReferenceType,
    Position,
    getMatchingDefinitionsFromEnvFiles,
    Logger,
    BrunoVariableType,
    LineBreakType,
} from "@global_shared";
import {
    JsFileInContextRootRequest,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    mapStaticEnvVariablesFromMultipleCollectionsToCompletions,
    mapStaticEnvVariablesToCompletions,
    TypedCollection,
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
    const { token } = baseRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableRelatedFunction =
        getEnvVariableRelatedFunctionForRequest(baseRequest);

    return envVariableRelatedFunction != undefined
        ? getResultsForEnvironmentVariable(
              envVariableRelatedFunction.variable,
              {
                  collection,
                  functionType: envVariableRelatedFunction.type,
              },
              baseRequest,
              configuredEnvironmentName,
              logger,
          )
        : undefined;
}

/** Handles JS files that are not part of a collection, but within `additionalContextRoots` of at least one collection. */
export async function handleCompletionRequestForJsFileInContextRoot({
    baseRequest,
    collections,
    logger,
}: JsFileInContextRootRequest): Promise<CompletionItem[] | undefined> {
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

function getResultsForEnvironmentVariable(
    variable: { name: string; start: Position; end: Position },
    additionalData: {
        collection: TypedCollection;
        functionType: VariableReferenceType;
    },
    baseRequest: LanguageFeatureBaseRequest,
    configuredEnvironmentName?: string,
    logger?: Logger,
) {
    const { collection, functionType } = additionalData;
    const { token, documentHelper: docHelper } = baseRequest;

    const matchingEnvVariableDefinitions = getMatchingDefinitionsFromEnvFiles(
        collection,
        undefined,
        configuredEnvironmentName,
    );

    if (matchingEnvVariableDefinitions.length == 0) {
        return [];
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapStaticEnvVariablesToCompletions(
        {
            variable,
            functionType,
            variableType: BrunoVariableType.Environment,
            documentLineBreak:
                docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
        },
        matchingEnvVariableDefinitions.map(
            ({
                file,
                matchingVariables,
                isConfiguredEnv,
                inheritedByEnvironmentName,
            }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
                inheritedByEnvironmentName,
            }),
        ),
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        "Cancellation requested for completion provider for JS files.",
    );
}
