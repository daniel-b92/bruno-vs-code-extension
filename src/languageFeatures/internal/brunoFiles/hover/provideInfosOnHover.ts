import {
    CancellationToken,
    commands,
    Hover,
    languages,
    MarkdownString,
    TextDocument,
    Position as VsCodePosition,
} from "vscode";
import {
    Block,
    Collection,
    CollectionItemProvider,
    getConfiguredTestEnvironment,
    isBodyBlock,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    shouldBeCodeBlock,
    TextDocumentHelper,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";

interface ProviderParams {
    collection: Collection;
    file: {
        document: TextDocument;
    };
    hoverRequest: {
        position: VsCodePosition;
        blockContainingPosition: Block;
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

            const { blocks: parsedBlocks } = parseBruFile(
                new TextDocumentHelper(document.getText()),
            );

            const blockContainingPosition = parsedBlocks.find(
                ({ contentRange }) =>
                    mapToVsCodeRange(contentRange).contains(position),
            );

            if (!blockContainingPosition) {
                return undefined;
            }

            if (shouldBeCodeBlock(blockContainingPosition.name)) {
                return getHoverForCodeBlocks(queue, {
                    collection,
                    file: { document },
                    hoverRequest: { position, blockContainingPosition, token },
                    logger,
                });
            }

            if (isBodyBlock(blockContainingPosition.name)) {
                return getHoverForNonCodeBlocks({
                    collection,
                    file: { document },
                    hoverRequest: { position, blockContainingPosition, token },
                    logger,
                });
            }
        },
    });
}

function getHoverForNonCodeBlocks({
    collection,
    file: { document },
    hoverRequest: { position, token: _token },
    logger: _logger,
}: ProviderParams) {
    const pattern = /{{\S+}}/;
    let remainingText = document.lineAt(position.line).text;
    let alreadyCheckedText = "";
    let variableName: undefined | string = undefined;

    do {
        const matches = pattern.exec(remainingText);

        if (!matches || matches.length == 0) {
            break;
        }

        const containsPosition =
            position.character >= alreadyCheckedText.length + matches.index &&
            position.character <=
                alreadyCheckedText.length + matches.index + matches[0].length;

        if (containsPosition) {
            variableName = matches[0].substring(
                matches[0].indexOf("{{") + 2,
                matches[0].indexOf("}}"),
            );
            break;
        }
        const currentSectionEnd = matches.index + matches[0].length;
        alreadyCheckedText = alreadyCheckedText.concat(
            remainingText.substring(0, currentSectionEnd),
        );

        remainingText = remainingText.substring(currentSectionEnd);
    } while (remainingText.length > 0);

    const environmentName = getConfiguredTestEnvironment();
    const environmentFile = environmentName
        ? collection.getEnvironmentFile(environmentName)
        : undefined;
    const variableDefinition = environmentFile
        ?.getVariables()
        .find(({ key }) => variableName == key);

    if (!variableName || !variableDefinition) {
        return undefined;
    }

    return new Hover(new MarkdownString(variableDefinition.value));
}

async function getHoverForCodeBlocks(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    {
        collection,
        file: { document },
        hoverRequest: { position, blockContainingPosition, token },
        logger,
    }: ProviderParams,
) {
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
            blockContainingPosition.name as RequestFileBlockName,
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
                mapToRangeWithinBruFile(
                    blockContainingPosition,
                    temporaryJsDoc.getText(),
                    resultFromJsFile[0].range,
                    logger,
                ),
            )
          : resultFromJsFile[0];
}
