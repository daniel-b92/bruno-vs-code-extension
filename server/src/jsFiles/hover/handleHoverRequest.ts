import {
    Position,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    Logger,
    getMatchingDefinitionsFromEnvFiles,
    EnvVariableNameMatchingMode,
} from "@global_shared";
import {
    getHoverContentForStaticEnvVariables,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    TypedCollection,
} from "../../shared";
import { Hover } from "vscode-languageserver";

export function handleHoverRequest({
    baseRequest,
    itemProvider,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo) {
    const collection = itemProvider.getAncestorCollectionForPath(
        baseRequest.filePath,
    );

    if (!collection) {
        return null;
    }

    return getHover({
        file: { collection },
        baseRequest,
        logger,
        configuredEnvironmentName,
    });
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

    const envVariableRelatedFunction =
        getEnvVariableRelatedFunctionForRequest(params);

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
            EnvVariableNameMatchingMode.Exact,
            configuredEnvironmentName,
        );

    const content = getHoverContentForStaticEnvVariables(
        matchingStaticEnvVariableDefinitions,
    );

    return content
        ? { contents: { kind: "markdown", value: content } }
        : undefined;
}

function getEnvVariableRelatedFunctionForRequest(params: {
    file: { collection: TypedCollection };
    baseRequest: LanguageFeatureBaseRequest;
}) {
    const {
        baseRequest: { documentHelper, position },
    } = params;

    return getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: {
            asString: documentHelper.getText(),
            startPosition: new Position(0, 0),
        },
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        position,
    });
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(`Cancellation requested for hover provider for JS files.`);
}
