import { basename, resolve } from "path";
import {
    CollectionFormat,
    getFileExtensionForFormat,
    RequestType,
    RequestFileBlockName,
    MethodBlockBodies,
    getMaxSequenceForRequestsAndAppFiles,
    AuthTypes,
    getPossibleMethodBlocksForRequestType,
    FileInfoType,
    getCollectionPresets,
    sanitizeUrlForNewRequest,
    doesRequestTypeSupportUrlParams,
} from "@global_shared";
import {
    TypedCollectionItemProvider,
    getContentForMetaBlock,
    getContentForDefaultMethodBlock,
    getLineBreak,
    getContentForUrlParamsBlocks,
    getYamlParamsForUrl,
    FileSystemCacheSyncingHelper,
    BrunoTreeItem,
} from "@shared";
import { commands, Uri, window } from "vscode";
import { validateNewItemNameIsUnique } from "../validateNewItemNameIsUnique";
import { promisify } from "util";
import { writeFile } from "fs";
import { stringify } from "yaml";

export async function createRequestFile(
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    item: BrunoTreeItem,
) {
    const parentFolderPath = item.getPath();

    const collection =
        itemProvider.getAncestorCollectionForPath(parentFolderPath);

    if (!collection) {
        window.showErrorMessage(
            `Could not determine the collection for path '${parentFolderPath}'.`,
        );
        return;
    }

    const format = collection.getFormat();
    const fileExtension = getFileExtensionForFormat(format);

    const requestName = await window.showInputBox({
        title: `Create request file in '${basename(parentFolderPath)}'`,
        value: "request_name",
        validateInput: (newFileName: string) => {
            return validateNewItemNameIsUnique(
                resolve(parentFolderPath, `${newFileName}${fileExtension}`),
            );
        },
    });

    if (requestName == undefined) {
        return;
    }

    const presets = await getCollectionPresets(
        collection.getRootDirectory(),
        format,
    );
    const pickedLabels: string[] = [];

    const quickPick = window.createQuickPick();

    quickPick.totalSteps = 2;
    quickPick.step = 1;
    quickPick.title = "Select the request type";
    quickPick.items = Object.values(RequestType).map((type) => ({
        label: type,
    }));
    quickPick.activeItems = quickPick.items.filter(
        ({ label }) => label == presets?.requestType,
    );

    quickPick.onDidChangeSelection(async (picks) => {
        pickedLabels.push(...picks.map(({ label }) => label));

        if (
            pickedLabels.length == 1 &&
            getSingleMethodBlockForRequestType(pickedLabels[0]) == undefined
        ) {
            quickPick.hide();

            quickPick.step = 2;
            quickPick.title = "Select the method";
            quickPick.items = [
                { label: RequestFileBlockName.Put },
                { label: RequestFileBlockName.Post },
                { label: RequestFileBlockName.Get },
                { label: RequestFileBlockName.Patch },
                { label: RequestFileBlockName.Options },
                { label: RequestFileBlockName.Head },
            ];

            quickPick.show();
            return;
        }

        quickPick.dispose();

        if (pickedLabels.length == 1) {
            // For gRPC and websocket requests, there is only one possible method block, so there's no need to let the user choose it.
            pickedLabels.push(
                getSingleMethodBlockForRequestType(
                    pickedLabels[0],
                ) as RequestFileBlockName,
            );
        }

        const filePath = resolve(
            parentFolderPath,
            `${requestName}${fileExtension}`,
        );

        if (pickedLabels.length != 2) {
            throw new Error(
                `Did not find as many picked items as expected. Expected to get 2. Instead got '${JSON.stringify(
                    pickedLabels,
                    null,
                    2,
                )}'`,
            );
        }

        const requestSequence =
            ((await getMaxSequenceForRequestsAndAppFiles(
                itemProvider,
                parentFolderPath,
            )) ?? 0) + 1;

        const requestType = pickedLabels[0] as RequestType;
        const url = sanitizeUrlForNewRequest(presets?.requestUrl ?? "");

        const failed = await promisify(writeFile)(
            filePath,
            getFileContent(format, requestSequence, {
                filePath,
                requestName,
                requestType,
                methodBlockName: pickedLabels[1],
                url,
            }),
        ).catch(() => true);

        if (failed) {
            window.showErrorMessage(`An unexpected error occured.`);
            return;
        }

        // After the new file has been registered in the cache, the explorer should be able to reveal it when opened in the editor.
        await cacheSyncingHelper.waitForFileToBeRegisteredInCache(
            collection.getRootDirectory(),
            filePath,
        );

        await commands.executeCommand("vscode.open", Uri.file(filePath));
    });

    quickPick.show();
}

function getSingleMethodBlockForRequestType(requestType: string) {
    const possibleMethodBlocks =
        getPossibleMethodBlocksForRequestType(requestType);

    return possibleMethodBlocks.length == 1
        ? possibleMethodBlocks[0]
        : undefined;
}

function getFileContent(
    format: CollectionFormat,
    requestSequence: number,
    chosenData: {
        filePath: string;
        requestName: string;
        requestType: RequestType;
        methodBlockName: string;
        url: string;
    },
) {
    const { filePath, requestName, requestType, methodBlockName, url } =
        chosenData;

    if (format == CollectionFormat.Yaml) {
        return getYamlFileContent(
            requestSequence,
            requestName,
            requestType,
            methodBlockName,
            url,
        );
    }

    const lineBreak = getLineBreak(filePath);

    const metaBlockContent = getContentForMetaBlock(
        filePath,
        {
            name: requestName,
            sequence: requestSequence,
            type: requestType,
        },
        lineBreak,
    );

    const methodBlockContent = getContentForDefaultMethodBlock(
        filePath,
        methodBlockName,
        {
            url,
            auth: AuthTypes.None,
            // Websocket requests always use the `body:ws` blocks for their messages.
            body:
                requestType == RequestType.Ws
                    ? MethodBlockBodies.Ws
                    : MethodBlockBodies.None,
        },
        lineBreak,
    );

    const paramsBlocksContent = doesRequestTypeSupportUrlParams(requestType)
        ? getContentForUrlParamsBlocks(filePath, url, lineBreak)
        : [];

    return [metaBlockContent, methodBlockContent, ...paramsBlocksContent].join(
        lineBreak,
    );
}

function getYamlFileContent(
    requestSequence: number,
    requestName: string,
    requestType: RequestType,
    methodBlockName: string,
    url: string,
) {
    const yamlType = getYamlTypeForRequestType(requestType);
    const topLevelProperties = {
        info: { name: requestName, type: yamlType, seq: requestSequence },
        [yamlType]:
            requestType == RequestType.Grpc || requestType == RequestType.Ws
                ? { url }
                : {
                      method: methodBlockName.toUpperCase(),
                      url,
                      // Only the `http` section can contain `params`.
                      ...(requestType == RequestType.Http
                          ? getYamlParamsForUrl(url)
                          : {}),
                  },
    };

    // Bruno desktop separates the top level properties by an empty line.
    return Object.entries(topLevelProperties)
        .map(([key, value]) => stringify({ [key]: value }))
        .join("\n");
}

function getYamlTypeForRequestType(requestType: RequestType): FileInfoType {
    switch (requestType) {
        case RequestType.Http:
            return FileInfoType.Http;
        case RequestType.Graphql:
            return FileInfoType.Graphql;
        case RequestType.Grpc:
            return FileInfoType.Grpc;
        case RequestType.Ws:
            return FileInfoType.Websocket;
    }
}
