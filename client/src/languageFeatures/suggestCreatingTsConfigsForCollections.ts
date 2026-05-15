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
    getLineBreakFromSettings,
    DialogOptionLabelEnum,
    TypedCollectionItemProvider,
    TypedCollection,
} from "../shared";
import {
    checkIfPathExistsAsync,
    filterAsync,
    getTemporaryJsFileBasename,
    getTemporaryJsFileNameInFolder,
    LineBreakType,
} from "@global_shared";
import { readdir } from "fs/promises";

interface MissingTsConfigOccurences {
    collectionsMissingInRootFolders: TypedCollection[];
    additionalContextRoots: string[];
}

export async function suggestCreatingTsConfigsForCollections(
    itemProvider: TypedCollectionItemProvider,
) {
    if (
        !workspace
            .getConfiguration()
            .get<boolean>(getSettingsKeyForShowingSuggestion(), false)
    ) {
        return;
    }

    const { collectionsMissingInRootFolders, additionalContextRoots } =
        await getCollectionsWithoutTsConfigs(itemProvider);

    if (
        collectionsMissingInRootFolders.length == 0 &&
        additionalContextRoots.length == 0
    ) {
        return;
    }

    const confirmationOption = DialogOptionLabelEnum.Confirm;
    const cancelOption = DialogOptionLabelEnum.Cancel;
    const doNotAskAgainOption = DialogOptionLabelEnum.DoNotAskAgain;

    const areConfigsForBothSourcesMissing =
        collectionsMissingInRootFolders.length > 0 &&
        additionalContextRoots.length > 0;

    const pickedOption = await window.showInformationMessage<MessageItem>(
        `It's recommended to add a 'tsconfig.json' in the root folder of every collection and every 'additionalContextRoot' that contains JS files, in order for the language features to work properly.
Add a default config for ${
            collectionsMissingInRootFolders.length > 0
                ? `collection root folder(s) ${formatPathsForDialog(collectionsMissingInRootFolders.map((collection) => collection.getRootDirectory()))}`
                : ""
        }`.concat(
            areConfigsForBothSourcesMissing ? " and" : "",
            additionalContextRoots.length > 0
                ? ` additionalContextRoot(s) ${formatPathsForDialog(additionalContextRoots)}`
                : "",
            "?",
        ),
        { title: confirmationOption },
        { title: cancelOption },
        { title: doNotAskAgainOption },
    );

    if (!pickedOption || pickedOption.title == cancelOption) {
        return;
    }
    if (pickedOption.title == doNotAskAgainOption) {
        await workspace
            .getConfiguration()
            .update(
                getSettingsKeyForShowingSuggestion(),
                false,
                ConfigurationTarget.Global,
            );

        return;
    }

    const results = await createTsConfigs({
        collectionsMissingInRootFolders,
        additionalContextRoots,
    });
    window.showInformationMessage(
        `Created ${results.filter((success) => success).length} / ${collectionsMissingInRootFolders.length + additionalContextRoots.length} tsconfigs.`,
    );
}

async function getCollectionsWithoutTsConfigs(
    itemProvider: TypedCollectionItemProvider,
): Promise<MissingTsConfigOccurences> {
    const collectionsWithoutTsConfigInRootFolder = itemProvider
        .getRegisteredCollections()
        .filter(
            (collection) =>
                collection.getStoredDataForPath(
                    getTsConfigPathForCollection(collection),
                ) == undefined &&
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

    const additionalContextRootsWithoutTsConfig = await filterAsync(
        itemProvider.getUniqueAdditionalContextRoots(),
        async (contextRoot) =>
            !(await checkIfPathExistsAsync(
                getTsConfigPathForAdditionalContextRoot(contextRoot),
            )) &&
            (
                await readdir(contextRoot, {
                    withFileTypes: true,
                    recursive: true,
                })
            ).some(
                // Only if JS files exist in the collection, the tsconfig is needed. Otherwise an error will be shown in the tsconfig because no files are included.
                (item) =>
                    item.isFile() &&
                    extname(item.name) == ".js" &&
                    item.name != getTemporaryJsFileBasename(),
            ),
    );

    return {
        collectionsMissingInRootFolders: collectionsWithoutTsConfigInRootFolder,
        additionalContextRoots: additionalContextRootsWithoutTsConfig,
    };
}

async function createTsConfigs({
    collectionsMissingInRootFolders,
    additionalContextRoots,
}: MissingTsConfigOccurences) {
    const allPaths = collectionsMissingInRootFolders
        .map((collection) => getTsConfigPathForCollection(collection))
        .concat(
            additionalContextRoots.map((root) =>
                getTsConfigPathForAdditionalContextRoot(root),
            ),
        );
    const fileContents = Buffer.from(
        getDefaultTsConfigContent(getLineBreakFromSettings()),
    );

    return await Promise.all(
        allPaths.map(async (path) => {
            const workspaceEdit = new WorkspaceEdit();

            workspaceEdit.createFile(Uri.file(path), {
                contents: fileContents,
            });

            const editResult = await workspace.applyEdit(workspaceEdit);

            if (!editResult) {
                window.showErrorMessage(
                    `Unexpected error occured while trying to create file '${path}'`,
                );
            }

            return editResult;
        }),
    );
}

function getDefaultTsConfigContent(lineBreak: LineBreakType) {
    return `{
    "compilerOptions": {
        "module": "commonjs",
        "target": "es2025",
        "lib": ["ES2025"],
        "noEmit": true,
        "allowJs": true
    },
    "exclude": ["node_modules"]
}
`.replace(/(\n|\r\n)/g, lineBreak);
}

function formatPathsForDialog(paths: string[]) {
    const names = paths.map((path) => basename(path));

    return names.length > 1
        ? JSON.stringify(names)
        : names.length == 1
          ? `'${names[0]}'`
          : "";
}

function getSettingsKeyForShowingSuggestion() {
    return "bru-as-code.suggestCreatingTsConfigsForCollections";
}

function getTsConfigPathForCollection(collection: TypedCollection) {
    return resolve(collection.getRootDirectory(), "tsconfig.json");
}

function getTsConfigPathForAdditionalContextRoot(
    additionalContextRootFolder: string,
) {
    return resolve(additionalContextRootFolder, "tsconfig.json");
}
