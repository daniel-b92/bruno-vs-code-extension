import { basename, extname, resolve } from "path";
import {
    workspace,
    window,
    WorkspaceEdit,
    Uri,
    MessageItem,
    ConfigurationTarget,
} from "vscode";
import {
    CollectionItemProvider,
    filterAsync,
    checkIfPathExistsAsync,
    Collection,
    getLineBreakFromSettings,
    getTemporaryJsFileNameInFolder,
    DialogOptionLabelEnum,
} from "../shared";

export async function suggestCreatingTsConfigsForCollections(
    itemProvider: CollectionItemProvider,
) {
    const collectionsMissingTsConfig =
        await getCollectionsWithoutTsConfigs(itemProvider);

    if (!collectionsMissingTsConfig || collectionsMissingTsConfig.length == 0) {
        return;
    }

    const confirmationOption = DialogOptionLabelEnum.Confirm;
    const cancelOption = DialogOptionLabelEnum.Cancel;
    const doNotAskAgainOption = DialogOptionLabelEnum.DoNotAskAgain;

    const pickedOption = await window.showInformationMessage<MessageItem>(
        `It is recommended to add a 'tsconfig.json' in the root folder of every collection that contains JS files (to avoid errors for the Typescript language server).
Add a default config for ${
            collectionsMissingTsConfig.length == 1
                ? `the collection '${basename(collectionsMissingTsConfig[0].getRootDirectory())}'?`
                : `each of the following collections?
${JSON.stringify(
    collectionsMissingTsConfig.map((collection) =>
        basename(collection.getRootDirectory()),
    ),
    null,
    2,
)}?`
        }`,
        { title: confirmationOption },
        { title: cancelOption },
        { title: doNotAskAgainOption },
    );

    if (!pickedOption || pickedOption.title == cancelOption) {
        return;
    } else if (pickedOption.title == doNotAskAgainOption) {
        await workspace
            .getConfiguration()
            .update(
                getSettingsKeyForShowingSuggestion(),
                false,
                ConfigurationTarget.Global,
            );

        return;
    }

    const results = await createTsConfigs(collectionsMissingTsConfig);
    window.showInformationMessage(
        `Created a tsconfig for ${results.filter(({ success }) => success).length} / ${collectionsMissingTsConfig.length} collections.`,
    );
}

async function getCollectionsWithoutTsConfigs(
    itemProvider: CollectionItemProvider,
): Promise<undefined | Collection[]> {
    if (
        !workspace
            .getConfiguration()
            .get<boolean>(getSettingsKeyForShowingSuggestion(), false)
    ) {
        return undefined;
    }

    return await filterAsync(
        itemProvider.getRegisteredCollections().slice(),
        async (collection) =>
            !(await checkIfPathExistsAsync(
                getTsConfigPathForCollection(collection),
            )) &&
            collection.getAllStoredDataForCollection().some(
                // Only if JS files exist in the collection, the tsconfig is needed. Otherwise an error will be shown in the tsconfig because no files are included.
                ({ item }) =>
                    extname(item.getPath()) == ".js" &&
                    item.getPath() !=
                        getTemporaryJsFileNameInFolder(
                            collection.getRootDirectory(),
                        ),
            ),
    );
}

async function createTsConfigs(collections: Collection[]) {
    const results: { collection: Collection; success: boolean }[] = [];

    for (const collection of collections) {
        const workspaceEdit = new WorkspaceEdit();

        workspaceEdit.createFile(
            Uri.file(getTsConfigPathForCollection(collection)),
            {
                contents: Buffer.from(
                    getDefaultTsConfigContent(getLineBreakFromSettings()),
                ),
            },
        );

        const editResult = await workspace.applyEdit(workspaceEdit);

        if (!editResult) {
            window.showErrorMessage(
                `Unexpected error while trying to create file '${getTsConfigPathForCollection(collection)}'`,
            );
        }

        results.push({ collection, success: editResult });
    }

    return results;
}

function getDefaultTsConfigContent(lineBreak: "\n" | "\r\n") {
    return `{
    "compilerOptions": {
        "module": "commonjs",
        "target": "es2020",
        "lib": ["es2020"],
        "noEmit": true,
        "allowJs": true
    },
    "exclude": ["node_modules"]
}
`.replace(/(\n|\r\n)/g, lineBreak);
}

function getSettingsKeyForShowingSuggestion() {
    return "bru-as-code.suggestCreatingTsConfigsForCollections";
}

function getTsConfigPathForCollection(collection: Collection) {
    return resolve(collection.getRootDirectory(), "tsconfig.json");
}
