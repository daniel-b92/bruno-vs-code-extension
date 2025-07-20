import {
    TestController,
    TestItem as VscodeTestItem,
    TestRunProfile,
    TestRunRequest,
    CancellationToken,
    TestRunProfileKind,
    Event as VscodeEvent,
    Uri,
    window,
    ProgressLocation,
    ExtensionContext,
} from "vscode";
import { startTestRun } from "./internal/startTestRun";
import { TestRunQueue } from "./internal/testRunQueue";
import { addTestItemAndAncestorsToTestTree } from "./testTreeUtils/addTestItemAndAncestorsToTestTree";
import { getTestId } from "./testTreeUtils/testTreeHelper";
import { dirname, extname } from "path";
import {
    TestRunnerDataHelper,
    CollectionDirectory,
    Collection,
    CollectionFile,
    normalizeDirectoryPath,
    CollectionItemProvider,
    FileChangeType,
    getExtensionForRequestFiles,
    CollectionItem,
    getLoggerFromSubscriptions,
    someAsync,
} from "../shared";

export async function activateRunner(
    context: ExtensionContext,
    ctrl: TestController,
    collectionItemProvider: CollectionItemProvider,
    startTestRunEvent: VscodeEvent<Uri>
) {
    const watchingTests = new Map<
        VscodeTestItem | "ALL",
        TestRunProfile | undefined
    >();
    const queue = new TestRunQueue(ctrl);
    const testRunnerDataHelper = new TestRunnerDataHelper(ctrl);
    const logger = getLoggerFromSubscriptions(context);

    handleTestTreeUpdates(ctrl, collectionItemProvider, testRunnerDataHelper);

    collectionItemProvider.subscribeToUpdates()(async (updates) => {
        for (const {
            data: { item: changedItem },
        } of updates) {
            if (watchingTests.has("ALL")) {
                await startTestRun(
                    ctrl,
                    new TestRunRequest(
                        undefined,
                        undefined,
                        watchingTests.get("ALL"),
                        true
                    ),
                    collectionItemProvider,
                    queue,
                    logger
                );
                return;
            }

            const include: VscodeTestItem[] = [];
            let profile: TestRunProfile | undefined;

            for (const [watchedItem, thisProfile] of watchingTests) {
                const cast = watchedItem as VscodeTestItem;

                // If the modified item is a descendant of a watched item, trigger a testrun for that watched item.
                if (
                    cast.uri?.fsPath
                        ? changedItem.getPath().includes(cast.uri.fsPath)
                        : false
                ) {
                    include.push(cast);
                    profile = thisProfile;
                }
            }

            if (include.length) {
                await startTestRun(
                    ctrl,
                    new TestRunRequest(include, undefined, profile, true),
                    collectionItemProvider,
                    queue,
                    logger
                );
            }
        }
    });

    const runHandler = async (
        request: TestRunRequest,
        cancellation: CancellationToken
    ) => {
        if (!request.continuous) {
            return await startTestRun(
                ctrl,
                request,
                collectionItemProvider,
                queue,
                logger
            );
        }

        if (request.include === undefined) {
            watchingTests.set("ALL", request.profile);
            cancellation.onCancellationRequested(() =>
                watchingTests.delete("ALL")
            );
        } else {
            request.include.forEach((item) =>
                watchingTests.set(item, request.profile)
            );
            cancellation.onCancellationRequested(() =>
                request.include!.forEach((item) => watchingTests.delete(item))
            );
        }
    };

    ctrl.refreshHandler = () => {
        window.withProgress(
            {
                location: ProgressLocation.Window,
                title: "Refreshing Bruno test tree...",
            },
            () => {
                return new Promise<void>((resolve) => {
                    ctrl.items.replace([]);

                    collectionItemProvider.refreshCache().then(() => {
                        const collections =
                            collectionItemProvider.getRegisteredCollections();

                        addMissingTestCollectionsAndItemsToTestTree(
                            ctrl,
                            testRunnerDataHelper,
                            collections
                        ).then(() => {
                            // The displayed test tree view is only updated correctly, if you re-add the collection on top level again
                            collections.forEach((collection) =>
                                addCollectionTestItemToTestTree(
                                    ctrl,
                                    collection
                                )
                            );
                            resolve();
                        });
                    });
                });
            }
        );
    };

    const defaultProfile = ctrl.createRunProfile(
        "Run Bruno Tests",
        TestRunProfileKind.Run,
        runHandler,
        true,
        undefined,
        true
    );

    ctrl.resolveHandler = async (item) => {
        if (!item) {
            await addMissingTestCollectionsAndItemsToTestTree(
                ctrl,
                testRunnerDataHelper,
                collectionItemProvider.getRegisteredCollections()
            );
            return;
        }
        const path = (item.uri as Uri).fsPath;

        const collection =
            collectionItemProvider.getAncestorCollectionForPath(path);
        if (!collection) {
            throw new Error(
                `Did not find registered collection for item with path '${path}'`
            );
        }

        const data = collection.getStoredDataForPath(path);
        if (data && data.item instanceof CollectionDirectory) {
            await testRunnerDataHelper.addTestTreeItemsForDirectoryAndDescendants(
                collection,
                data.item
            );

            // The displayed test tree view is only updated correctly, if you re-add the collection on top level again
            addCollectionTestItemToTestTree(ctrl, collection);
        }
    };

    startTestRunEvent(async (uri) => {
        let testItem: VscodeTestItem | undefined;

        const isRunnable = await someAsync(
            collectionItemProvider.getRegisteredCollections().slice(),
            async (collection) => {
                const maybeItem = collection.getStoredDataForPath(uri.fsPath);

                if (
                    maybeItem &&
                    (await isRelevantForTestTree(
                        testRunnerDataHelper,
                        collection,
                        maybeItem.item
                    ))
                ) {
                    testItem = maybeItem.testItem;
                    return true;
                } else {
                    return false;
                }
            }
        );

        if (isRunnable) {
            await startTestRun(
                ctrl,
                new TestRunRequest(
                    [testItem as VscodeTestItem],
                    undefined,
                    defaultProfile,
                    false
                ),
                collectionItemProvider,
                queue,
                logger
            );
        } else {
            window.showInformationMessage(
                "No bruno tests found for selected item."
            );
        }
    });
}

async function addMissingTestCollectionsAndItemsToTestTree(
    controller: TestController,
    testRunnerDataHelper: TestRunnerDataHelper,
    registeredCollections: readonly Collection[]
) {
    for (const collection of registeredCollections) {
        await testRunnerDataHelper.addTestTreeItemsForDirectoryAndDescendants(
            collection,
            collection.getStoredDataForPath(collection.getRootDirectory())
                ?.item as CollectionDirectory
        );

        // The test tree view is only updated correctly, if you re-add the collection on top level again
        addCollectionTestItemToTestTree(controller, collection);
    }
}

function handleTestTreeUpdates(
    controller: TestController,
    collectionItemProvider: CollectionItemProvider,
    testRunnerDataHelper: TestRunnerDataHelper
) {
    collectionItemProvider.subscribeToUpdates()(async (updates) => {
        for (const {
            collection,
            data: { item, testItem },
            updateType,
            changedData,
        } of updates) {
            if (
                updateType == FileChangeType.Created &&
                (await isRelevantForTestTree(
                    testRunnerDataHelper,
                    collection,
                    item
                ))
            ) {
                addTestItemAndAncestorsToTestTree(controller, collection, item);
                // ToDo: Fix handling of creation of Collection directories
            } else if (
                updateType == FileChangeType.Modified &&
                item instanceof CollectionFile &&
                extname(item.getPath()) == getExtensionForRequestFiles() &&
                changedData?.sequenceChanged
            ) {
                /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the
                new name and a deletion of the directory with the old name. */
                if (item.getSequence() != undefined) {
                    removeTestItemFromTree(
                        controller,
                        collection,
                        testItem.uri as Uri
                    );
                    addTestItemAndAncestorsToTestTree(
                        controller,
                        collection,
                        item
                    );
                } else if (item.getSequence() == undefined) {
                    // This case can e.g. happen if the sequence in the a .bru file is changed to an invalid value
                    removeTestItemFromTree(
                        controller,
                        collection,
                        testItem.uri as Uri
                    );
                }
            } else if (
                updateType == FileChangeType.Deleted &&
                (await isRelevantForTestTree(
                    testRunnerDataHelper,
                    collection,
                    item
                ))
            ) {
                removeTestItemFromTree(
                    controller,
                    collection,
                    testItem.uri as Uri
                );
            }

            // The test tree view is only updated correctly, if you re-add the collection on top level again
            if (
                updateType != FileChangeType.Deleted ||
                normalizeDirectoryPath(item.getPath()) !=
                    normalizeDirectoryPath(collection.getRootDirectory())
            ) {
                addCollectionTestItemToTestTree(controller, collection);
            }
        }
    });
}

function addCollectionTestItemToTestTree(
    controller: TestController,
    collection: Collection
) {
    controller.items.add(
        collection.getStoredDataForPath(collection.getRootDirectory())
            ?.testItem as VscodeTestItem
    );
}

function removeTestItemFromTree(
    controller: TestController,
    collection: Collection,
    itemUri: Uri
) {
    const parentItem = collection.getStoredDataForPath(dirname(itemUri.fsPath));

    if (parentItem) {
        parentItem.testItem.children.delete(getTestId(itemUri));
    } else {
        controller.items.delete(getTestId(itemUri));
    }
}

async function isRelevantForTestTree(
    testRunnerDataHelper: TestRunnerDataHelper,
    collection: Collection,
    item: CollectionItem
) {
    return (
        (item instanceof CollectionFile &&
            extname(item.getPath()) == getExtensionForRequestFiles() &&
            item.getSequence() != undefined) ||
        (item instanceof CollectionDirectory &&
            (
                await testRunnerDataHelper.getTestFileDescendants(
                    collection,
                    item
                )
            ).length > 0)
    );
}
