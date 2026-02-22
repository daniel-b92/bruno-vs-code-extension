import {
    Position,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionType,
    getInbuiltFunctionIdentifiers,
    Logger,
} from "@global_shared";
import {
    getHoverForEnvVariable,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    TypedCollection,
} from "../../shared";

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
}) {
    const {
        file: { collection },
        baseRequest: { position: requestPosition, token },
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

    const { inbuiltFunction, variable } = envVariableRelatedFunction;

    return getHoverForEnvVariable(
        {
            requestData: {
                collection,
                functionType: getInbuiltFunctionType(inbuiltFunction),
                requestPosition,
                variable,
                token,
            },
            logger,
        },
        configuredEnvironmentName,
    );
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
