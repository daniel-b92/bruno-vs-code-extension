import { commands, DocumentSelector, Hover, languages } from "vscode";
import {
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    JsCodeBlock,
} from "@global_shared";
import { TypedCollection, TypedCollectionItemProvider } from "@shared";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinSourceFile } from "../shared/codeBlocksUtils/mapToRangeWithinSourceFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { mapFromVsCodePosition, OutputChannelLogger } from "@shared";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";
import { mapToEnvVarNameParams } from "../shared/codeBlocksUtils/mapToGetEnvVarNameParams";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";

interface ProviderParamsForCodeBlock {
    file: {
        collection: TypedCollection;
        blockContainingPosition: JsCodeBlock;
    };
    hoverRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}

export function provideInfosOnHover(
    documentSelector: DocumentSelector,
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    ensureCacheIsReady: () => Promise<void>,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(documentSelector, {
        async provideHover(document, position, token) {
            await ensureCacheIsReady();

            const collection = itemProvider.getAncestorCollectionForPath(
                document.fileName,
            );
            const itemType = collection
                ?.getStoredDataForPath(document.fileName)
                ?.item.getItemType();

            if (!collection || !itemType) {
                return null;
            }

            const blockContainingPosition = getCodeBlockContainingPosition(
                document.getText(),
                position,
                itemType,
                collection.getFormat(),
            );

            if (!blockContainingPosition) {
                return undefined;
            }

            const params: ProviderParamsForCodeBlock = {
                file: { collection, blockContainingPosition },
                hoverRequest: { document, position, token },
                logger,
            };

            // The hover content is printed twice when also providing hovers via client (even if the provided content is different).
            if (!isCodeBlockRequestHandledByServer(params)) {
                return getResultsViaTempJsFile(queue, params);
            }

            return undefined;
        },
    });
}

async function getResultsViaTempJsFile(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    {
        file: { collection, blockContainingPosition },
        hoverRequest: { document, position, token },
        logger,
    }: ProviderParamsForCodeBlock,
) {
    const temporaryJsDoc = await waitForTempJsFileToBeInSync(
        tempJsUpdateQueue,
        {
            collection,
            sourceFileContentSnapshot: document.getText(),
            sourceFilePath: document.fileName,
            sourceFileEol: document.eol,
            token,
        },
        logger,
    );

    if (!temporaryJsDoc) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const resultFromJsFile = await commands.executeCommand<Hover[]>(
        "vscode.executeHoverProvider",
        temporaryJsDoc.uri,
        getPositionWithinTempJsFile(
            temporaryJsDoc.getText(),
            blockContainingPosition.name,
            mapFromVsCodePosition(
                position.translate(
                    -blockContainingPosition.contentRange.start.line,
                ),
            ),
        ),
    );

    return resultFromJsFile.length == 0
        ? null
        : resultFromJsFile[0].range
          ? new Hover(
                resultFromJsFile[0].contents,
                mapToRangeWithinSourceFile(
                    blockContainingPosition,
                    temporaryJsDoc.getText(),
                    resultFromJsFile[0].range,
                    logger,
                ),
            )
          : resultFromJsFile[0];
}

function isCodeBlockRequestHandledByServer({
    file: { collection, blockContainingPosition },
    hoverRequest,
    logger,
}: ProviderParamsForCodeBlock) {
    const { token } = hoverRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    // For environment variables, the language server already provides hovers.
    return (
        getFirstParameterForInbuiltFunctionIfStringLiteral(
            mapToEnvVarNameParams(
                {
                    file: {
                        collection,
                        blockContainingPosition,
                    },
                    request: hoverRequest,
                    logger,
                },
                getInbuiltFunctionIdentifiers(),
            ),
        ) != undefined
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
