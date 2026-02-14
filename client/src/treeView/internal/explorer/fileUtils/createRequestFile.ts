import { basename, resolve } from "path";
import {
    getExtensionForBrunoFiles,
    RequestType,
    RequestFileBlockName,
    MethodBlockAuth,
    MethodBlockBody,
    getMaxSequenceForRequests,
} from "@global_shared";
import {
    TypedCollectionItemProvider,
    getContentForMetaBlock,
    getContentForDefaultMethodBlock,
    getLineBreak,
    TypedCollection,
    FileSystemCacheSyncingHelper,
} from "@shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { commands, Uri, window } from "vscode";
import { validateNewItemNameIsUnique } from "../validateNewItemNameIsUnique";
import { promisify } from "util";
import { writeFile } from "fs";

export async function createRequestFile(
    itemProvider: TypedCollectionItemProvider,
    cacheSyncingHelper: FileSystemCacheSyncingHelper,
    item: BrunoTreeItem,
) {
    const parentFolderPath = item.getPath();

    const requestName = await window.showInputBox({
        title: `Create request file in '${basename(parentFolderPath)}'`,
        value: "request_name",
        validateInput: (newFileName: string) => {
            return validateNewItemNameIsUnique(
                resolve(
                    parentFolderPath,
                    `${newFileName}${getExtensionForBrunoFiles()}`,
                ),
            );
        },
    });

    if (requestName == undefined) {
        return;
    }

    const pickedLabels: string[] = [];

    const quickPick = window.createQuickPick();

    quickPick.totalSteps = 2;
    quickPick.step = 1;
    quickPick.title = "Select the request type";
    quickPick.items = Object.values(RequestType).map((type) => ({
        label: type,
    }));

    quickPick.onDidChangeSelection(async (picks) => {
        pickedLabels.push(...picks.map(({ label }) => label));

        if (pickedLabels.length == 1) {
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

        const filePath = resolve(
            parentFolderPath,
            `${requestName}${getExtensionForBrunoFiles()}`,
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

        const collection = itemProvider.getAncestorCollectionForPath(
            filePath,
        ) as TypedCollection;
        const requestSequence =
            ((await getMaxSequenceForRequests(
                itemProvider,
                parentFolderPath,
            )) ?? 0) + 1;

        const failed = await promisify(writeFile)(
            filePath,
            getFileContent(requestSequence, {
                filePath,
                requestName,
                requestType: pickedLabels[0] as RequestType,
                methodBlockName: pickedLabels[1],
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

        commands.executeCommand("vscode.open", Uri.file(filePath));
    });

    quickPick.show();
}

function getFileContent(
    requestSequence: number,
    chosenData: {
        filePath: string;
        requestName: string;
        requestType: RequestType;
        methodBlockName: string;
    },
) {
    const { filePath, requestName, requestType, methodBlockName } = chosenData;

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
            url: "",
            auth: MethodBlockAuth.None,
            body: MethodBlockBody.None,
        },
        lineBreak,
    );

    return metaBlockContent.concat(lineBreak, methodBlockContent);
}
