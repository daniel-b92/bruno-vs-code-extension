import { basename, resolve } from "path";
import {
    getExtensionForBrunoFiles,
    RequestType,
    RequestFileBlockName,
    addMetaBlock,
    appendDefaultMethodBlock,
    CollectionItemProvider,
} from "../../../../shared";
import { BrunoTreeItem } from "../../../brunoTreeItem";
import { commands, Uri, window } from "vscode";
import { validateNewItemNameIsUnique } from "../validateNewItemNameIsUnique";
import { promisify } from "util";
import { writeFile } from "fs";

export async function createRequestFile(
    itemProvider: CollectionItemProvider,
    item: BrunoTreeItem
) {
    const parentFolderPath = item.getPath();

    const requestName = await window.showInputBox({
        title: `Create request file in '${basename(parentFolderPath)}'`,
        value: "request_name",
        validateInput: (newFileName: string) => {
            return validateNewItemNameIsUnique(
                resolve(
                    parentFolderPath,
                    `${newFileName}${getExtensionForBrunoFiles()}`
                )
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
            `${requestName}${getExtensionForBrunoFiles()}`
        );

        await promisify(writeFile)(filePath, "");

        const collectionForFile =
            itemProvider.getAncestorCollectionForPath(filePath);

        if (!collectionForFile) {
            throw new Error(
                `No registered collection found for newly created request file '${filePath}'`
            );
        }
        if (pickedLabels.length != 2) {
            throw new Error(
                `Did not find as many picked items as expected. Expected to get 2. Instead got '${JSON.stringify(
                    pickedLabels,
                    null,
                    2
                )}'`
            );
        }

        await addMetaBlock(
            collectionForFile,
            filePath,
            pickedLabels[0] as RequestType
        );

        await appendDefaultMethodBlock(
            filePath,
            pickedLabels[1] as RequestFileBlockName
        );

        commands.executeCommand("vscode.open", Uri.file(filePath));
    });

    quickPick.show();
}
