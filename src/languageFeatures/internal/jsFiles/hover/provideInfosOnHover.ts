import { languages } from "vscode";
import {
    Collection,
    CollectionItemProvider,
    OutputChannelLogger,
} from "../../../../shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { getHoverForEnvironmentVariable } from "../../shared/environmentVariables/getHoverForEnvironmentVariable";
import { getStringLiteralParameterForInbuiltFunction } from "../../shared/environmentVariables/getStringLiteralParameterForEnvVarInbuiltFunction";
import { getInbuiltFunctionsForEnvironmentVariables } from "../../shared/environmentVariables/getInbuiltFunctionsForEnvironmentVariables";

export function provideInfosOnHover(
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getJsFileDocumentSelector(), {
        async provideHover(document, position, token) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );

            if (!collection) {
                return null;
            }

            return getHover({
                file: { collection },
                baseRequest: { document, position, token },
                logger,
            });
        },
    });
}

async function getHover(params: {
    file: { collection: Collection };
    baseRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        file: { collection },
        baseRequest: { token },
        logger,
    } = params;

    const envVariableRelatedFunction =
        getEnvVariableRelatedFunctionForRequest(params);

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return envVariableRelatedFunction != undefined
        ? getHoverForEnvironmentVariable(
              collection,
              envVariableRelatedFunction.variableName,
              token,
              logger,
          )
        : undefined;
}

function getEnvVariableRelatedFunctionForRequest(params: {
    file: { collection: Collection };
    baseRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        baseRequest: { document },
        logger,
    } = params;
    const {
        getEnvironmentVariable: getEnvironmentVariableFunction,
        setEnvironmentVariable: setEnvironmentVariableFunction,
    } = getInbuiltFunctionsForEnvironmentVariables();

    return getStringLiteralParameterForInbuiltFunction({
        relevantContent: document.getText(),
        functionsToSearchFor: [
            getEnvironmentVariableFunction,
            setEnvironmentVariableFunction,
        ],
        request: params.baseRequest,
        logger,
    });
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
