import { languages } from "vscode";
import {
    Collection,
    CollectionItemProvider,
    OutputChannelLogger,
} from "../../../../shared";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { getHoverForEnvironmentVariable } from "../../shared/environmentVariables/getHoverForEnvironmentVariable";
import { parseEnvVariableNameFromTsSourceFile } from "../../shared/environmentVariables/parseEnvVariableNameFromTsSourceFile";

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

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableNameForRequest = getEnvVariableNameForRequest(params);

    if (envVariableNameForRequest) {
        return getHoverForEnvironmentVariable(
            collection,
            envVariableNameForRequest,
            token,
            logger,
        );
    }
}

function getEnvVariableNameForRequest(params: {
    file: { collection: Collection };
    baseRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        baseRequest: { document, token },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const paramName = parseEnvVariableNameFromTsSourceFile(
        {
            relevantContent: document.getText(),
        },
        params.baseRequest,
        logger,
    );

    return paramName?.text.match(/\w+/)?.[0];
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
