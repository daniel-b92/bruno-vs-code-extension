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
    BrunoEnvironmentFile,
    BrunoFileType,
    Collection,
    CollectionItemProvider,
    getConfiguredTestEnvironment,
    getExtensionForBrunoFiles,
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
import { basename } from "path";

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

            return getHoverForNonCodeBlocks({
                collection,
                file: { document },
                hoverRequest: { position, blockContainingPosition, token },
                logger,
            });
        },
    });
}

function getHoverForNonCodeBlocks({
    collection,
    file,
    hoverRequest,
    logger,
}: ProviderParams) {
    const {
        blockContainingPosition: { name: blockName },
        token,
    } = hoverRequest;
    if (
        (
            [
                RequestFileBlockName.Docs,
                RequestFileBlockName.Meta,
                RequestFileBlockName.Settings,
            ] as string[]
        ).includes(blockName)
    ) {
        // In some blocks, variables do not make sense.
        return undefined;
    }

    const variableName = getVariableNameContainingPositionForNonCodeBlock({
        collection,
        file,
        hoverRequest,
        logger,
    });

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return undefined;
    }

    return variableName
        ? getHoverForVariable(collection, variableName, token, logger)
        : undefined;
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

function getHoverForVariable(
    collection: Collection,
    variableName: string,
    token: CancellationToken,
    logger?: OutputChannelLogger,
) {
    const tableHeader = `| value | environment name |
| --------------- | ---------------- |\n`;

    const configuredEnvironmentName = getConfiguredTestEnvironment();

    const matchingEnvironmentFiles = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                item.getItemType() == BrunoFileType.EnvironmentFile &&
                (configuredEnvironmentName
                    ? basename(item.getPath(), getExtensionForBrunoFiles()) ==
                      configuredEnvironmentName
                    : true),
        )
        .map(({ item }) => item as BrunoEnvironmentFile);

    if (matchingEnvironmentFiles.length == 0) {
        return undefined;
    }

    const matchingVariableDefinitions = matchingEnvironmentFiles
        .map((item) => {
            const matchingVariables = item
                .getVariables()
                .filter(({ key }) => variableName == key);

            return matchingVariables.length > 0
                ? {
                      file: item.getPath(),
                      matchingVariables,
                  }
                : undefined;
        })
        .filter((result) => result != undefined);

    if (matchingVariableDefinitions.length == 0) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return undefined;
    }

    return new Hover(
        new MarkdownString(
            tableHeader.concat(
                matchingVariableDefinitions
                    .map(({ file, matchingVariables }) => {
                        const environmentName = basename(
                            file,
                            getExtensionForBrunoFiles(),
                        );

                        return matchingVariables
                            .map(
                                ({ value }) =>
                                    `| ${value} | ${environmentName}  |`,
                            )
                            .join("\n");
                    })
                    .join("\n"),
            ),
        ),
    );
}

function getVariableNameContainingPositionForNonCodeBlock({
    file: { document },
    hoverRequest: { position, token },
    logger,
}: ProviderParams) {
    const pattern = /{{\S+}}/;
    let remainingText = document.lineAt(position.line).text;
    let alreadyCheckedText = "";
    let variableName: undefined | string = undefined;

    do {
        if (token.isCancellationRequested) {
            logger?.debug(`Cancellation requested for hover provider.`);
            return undefined;
        }

        const matches = pattern.exec(remainingText);

        if (!matches || matches.length == 0) {
            return undefined;
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

    return variableName;
}
