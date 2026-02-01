import { languages } from "vscode";
import {
    Position,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionType,
    getInbuiltFunctionIdentifiers,
} from "@global_shared";
import {
    Collection,
    CollectionItemProvider,
    OutputChannelLogger,
    mapFromVsCodePosition,
} from "@shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { getHoverForEnvVariable } from "../../shared/environmentVariables/getHoverForEnvVariable";

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
        baseRequest: { position: requestPosition, token },
        logger,
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

    const { inbuiltFunction, variableName } = envVariableRelatedFunction;

    return getHoverForEnvVariable({
        requestData: {
            collection,
            functionType: getInbuiltFunctionType(inbuiltFunction),
            requestPosition,
            variableName,
            token,
        },
        logger,
    });
}

function getEnvVariableRelatedFunctionForRequest(params: {
    file: { collection: Collection };
    baseRequest: LanguageFeatureRequest;
}) {
    const {
        baseRequest: { document, position },
    } = params;

    return getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: {
            asString: document.getText(),
            startPosition: new Position(0, 0),
        },
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        position: mapFromVsCodePosition(position),
    });
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
