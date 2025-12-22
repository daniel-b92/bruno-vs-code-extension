import { languages } from "vscode";
import {
    Collection,
    CollectionItemProvider,
    OutputChannelLogger,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
} from "../../../../shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { getHoverForEnvVariable } from "../../shared/environmentVariables/getHoverForEnvVariable";
import { getInbuiltFunctionIdentifiers } from "../../../../shared/languageUtils/commonBlocks/codeBlocks/inbuiltFunctionDefinitions/getInbuiltFunctionIdentifiers";

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
        ? getHoverForEnvVariable(
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

    return getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: document.getText(),
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        request: params.baseRequest,
        logger,
    });
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
