import { basename, dirname, extname, relative, resolve } from "path";
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
    collectionRoots: { path: string; additionalContextRoots: string[] }[];
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

    const { collectionRoots, additionalContextRoots } =
        await determineMissingTsConfigs(itemProvider);

    if (collectionRoots.length == 0 && additionalContextRoots.length == 0) {
        return;
    }

    const confirmationOption = DialogOptionLabelEnum.Confirm;
    const cancelOption = DialogOptionLabelEnum.Cancel;
    const doNotAskAgainOption = DialogOptionLabelEnum.DoNotAskAgain;

    const areConfigsForBothSourcesMissing =
        collectionRoots.length > 0 && additionalContextRoots.length > 0;

    const pickedOption = await window.showInformationMessage<MessageItem>(
        `It's recommended to add a 'tsconfig.json' in the root folder of every collection and every 'additionalContextRoot' that contains JS files, in order for the language features to work properly.
Add a default config for ${
            collectionRoots.length > 0
                ? `collection root folder(s) ${formatPathsForDialog(collectionRoots.map(({ path }) => path))}`
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
        collectionRoots,
        additionalContextRoots,
    });
    window.showInformationMessage(
        `Created ${results.filter((success) => success).length} / ${collectionRoots.length + additionalContextRoots.length} tsconfigs.`,
    );
}

async function determineMissingTsConfigs(
    itemProvider: TypedCollectionItemProvider,
): Promise<MissingTsConfigOccurences> {
    const collectionsWithoutTsConfigInRootFolder = itemProvider
        .getRegisteredCollections()
        .filter(
            (collection) =>
                collection.getStoredDataForPath(
                    getTsConfigPathForCollectionRoot(
                        collection.getRootDirectory(),
                    ),
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
        collectionRoots: collectionsWithoutTsConfigInRootFolder.map(
            (collection) => ({
                path: collection.getRootDirectory(),
                additionalContextRoots: collection.getAdditionalContextRoots(),
            }),
        ),
        additionalContextRoots: additionalContextRootsWithoutTsConfig,
    };
}

async function createTsConfigs({
    collectionRoots,
    additionalContextRoots,
}: MissingTsConfigOccurences) {
    const forCollectionRoots = collectionRoots.map(
        ({ path, additionalContextRoots }) => ({
            configPath: getTsConfigPathForCollectionRoot(path),
            pathsToInclude: additionalContextRoots,
        }),
    );
    const forAdditionalContextRoots = additionalContextRoots.map((root) => ({
        configPath: getTsConfigPathForAdditionalContextRoot(root),
    }));

    return await Promise.all(
        (
            forCollectionRoots as {
                configPath: string;
                pathsToInclude?: string[];
            }[]
        )
            .concat(forAdditionalContextRoots)
            .map(async ({ configPath, pathsToInclude }) => {
                const workspaceEdit = new WorkspaceEdit();
                const relativePathsToInclude =
                    pathsToInclude == undefined
                        ? undefined
                        : ["**/*"].concat(
                              pathsToInclude.map((toInclude) =>
                                  relative(dirname(configPath), toInclude),
                              ),
                          );

                const fileContents = Buffer.from(
                    getDefaultTsConfigContent(
                        getLineBreakFromSettings(),
                        relativePathsToInclude,
                    ),
                );

                workspaceEdit.createFile(Uri.file(configPath), {
                    contents: fileContents,
                });

                const editResult = await workspace.applyEdit(workspaceEdit);

                if (!editResult) {
                    window.showErrorMessage(
                        `Unexpected error occured while trying to create file '${configPath}'`,
                    );
                }

                return editResult;
            }),
    );
}

function getDefaultTsConfigContent(
    lineBreak: LineBreakType,
    pathsToInclude?: string[],
) {
    const compilerOptionsLines = [
        '"module": "commonjs"',
        '"target": "es2025"',
        '"lib": ["ES2025"]',
        '"noEmit": true',
        '"allowJs": true',
        '"types": ["node"]',
    ];
    return "{".concat(
        lineBreak,
        '\t"compilerOptions": {',
        lineBreak,
        "\t\t",
        compilerOptionsLines.join(`,${lineBreak}\t\t`),
        `${lineBreak}\t},${lineBreak}`,
        `\t"exclude": ["node_modules"]`,
        pathsToInclude && pathsToInclude.length > 0
            ? `,${lineBreak}\t"include": ${JSON.stringify(pathsToInclude)}`
            : "",
        lineBreak,
        "}",
    );
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

function getTsConfigPathForCollectionRoot(collectionRoot: string) {
    return resolve(collectionRoot, "tsconfig.json");
}

function getTsConfigPathForAdditionalContextRoot(
    additionalContextRootFolder: string,
) {
    return resolve(additionalContextRootFolder, "tsconfig.json");
}
