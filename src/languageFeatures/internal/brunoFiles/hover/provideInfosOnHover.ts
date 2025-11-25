import {
    CancellationToken,
    commands,
    Hover,
    languages,
    TextDocument,
    Position as VsCodePosition,
    Range as VsCodeRange,
} from "vscode";
import {
    Block,
    Collection,
    CollectionItemProvider,
    isBodyBlock,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";

interface ProviderParams {
    collection: Collection;
    file: {
        document: TextDocument;
        parsedBlocks: Block[];
    };
    hoverRequest: {
        position: VsCodePosition;
        token: CancellationToken;
    };
    logger?: OutputChannelLogger;
}

export function provideInfosOnHover(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getRequestFileDocumentSelector(), {
        async provideHover(document, position, token) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );

            if (!collection) {
                return null;
            }

            const parsedFile = parseBruFile(
                new TextDocumentHelper(document.getText()),
            );

            return provideHoverInfosForCodeBlocks(queue, {
                collection,
                file: { document, parsedBlocks: parsedFile.blocks },
                hoverRequest: { position, token },
                logger,
            });
        },
    });
}

async function provideHoverInfosForBodyBlocks({
    collection,
    file: { document, parsedBlocks },
    hoverRequest: { position, token },
    logger,
}: ProviderParams) {
    const blocksToCheck = parsedBlocks.filter(({ name }) => isBodyBlock(name));

    const isWithinBodyBlock = blocksToCheck.find(({ contentRange }) =>
        mapToVsCodeRange(contentRange).contains(position),
    );

    if (!isWithinBodyBlock) {
        return undefined;
    }

    const textLine = document.lineAt(position.line);
    const variableMatches = /{{\S+}}/.exec(textLine.text);

    if (!variableMatches || variableMatches.length == 0) {
        return undefined;
    }
}

async function provideHoverInfosForCodeBlocks(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    {
        collection,
        file: { document, parsedBlocks },
        hoverRequest: { position, token },
        logger,
    }: ProviderParams,
) {
    const blocksToCheck = getCodeBlocks(parsedBlocks);

    const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
        mapToVsCodeRange(contentRange).contains(position),
    );

    if (!blockInBruFile) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return undefined;
    }

    const temporaryJsDoc = await waitForTempJsFileToBeInSyncWithBruFile(
        tempJsUpdateQueue,
        {
            collection,
            bruFileContentSnapshot: document.getText(),
            bruFilePath: document.fileName,
            token,
        },
        logger,
    );

    if (!temporaryJsDoc) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return undefined;
    }

    const resultFromJsFile = await commands.executeCommand<Hover[]>(
        "vscode.executeHoverProvider",
        temporaryJsDoc.uri,
        getPositionWithinTempJsFile(
            temporaryJsDoc.getText(),
            blockInBruFile.name as RequestFileBlockName,
            mapFromVsCodePosition(
                position.translate(-blockInBruFile.contentRange.start.line),
            ),
        ),
    );

    return resultFromJsFile.length == 0
        ? null
        : resultFromJsFile[0].range
          ? new Hover(
                resultFromJsFile[0].contents,
                mapToRangeWithinBruFile(
                    blockInBruFile,
                    temporaryJsDoc.getText(),
                    resultFromJsFile[0].range,
                    logger,
                ),
            )
          : resultFromJsFile[0];
}
