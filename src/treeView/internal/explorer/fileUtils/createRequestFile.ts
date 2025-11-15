import { basename, resolve } from "path";
import {
    getExtensionForBrunoFiles,
    RequestType,
    RequestFileBlockName,
    CollectionItemProvider,
    getMaxSequenceForRequests,
    getContentForMetaBlock,
    getContentForDefaultMethodBlock,
    MethodBlockAuth,
    MethodBlockBody,
    getLineBreak,
} from "../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { commands, Uri, window } from "vscode";
import { validateNewItemNameIsUnique } from "../validateNewItemNameIsUnique";
import { promisify } from "util";
import { writeFile } from "fs";

export async function createRequestFile(
    itemProvider: CollectionItemProvider,
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

        const toAwait: Promise<void | boolean>[] = [];

        // After the new file has been registered in the cache, the explorer should be able to reveal it when opened in the editor.
        toAwait.push(itemProvider.waitForFileToBeRegisteredInCache(filePath));

        toAwait.push(
            promisify(writeFile)(
                filePath,
                await getFileContent(itemProvider, parentFolderPath, {
                    filePath,
                    requestName,
                    requestType: pickedLabels[0] as RequestType,
                    methodBlockName: pickedLabels[1],
                }),
            ),
        );

        await Promise.all(toAwait);

        commands.executeCommand("vscode.open", Uri.file(filePath));
    });

    quickPick.show();
}

async function getFileContent(
    itemProvider: CollectionItemProvider,
    parentFolderPath: string,
    chosenData: {
        filePath: string;
        requestName: string;
        requestType: RequestType;
        methodBlockName: string;
    },
) {
    const { filePath, requestName, requestType, methodBlockName } = chosenData;

    const maxExistingFileSequence = await getMaxSequenceForRequests(
        itemProvider,
        parentFolderPath,
    );

    const lineBreak = getLineBreak(filePath);

    const metaBlockContent = getContentForMetaBlock(
        filePath,
        {
            name: requestName,
            sequence: (maxExistingFileSequence ?? 0) + 1,
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
