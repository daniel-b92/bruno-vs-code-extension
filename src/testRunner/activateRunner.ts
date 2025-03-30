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
} from "vscode";
import { startTestRun } from "../testRunner/testRun/startTestRun";
import { TestRunQueue } from "../testRunner/testRun/testRunQueue";
import { CollectionItemProvider } from "../shared/state/collectionItemProvider";
import { FileChangeType } from "../shared/fileSystem/fileChangesDefinitions";
import { addTestItemToTestTree } from "./testTreeUtils/addTestItemToTestTree";
import { getTestId } from "./testTreeUtils/testTreeHelper";
import { dirname } from "path";

export async function activateRunner(
    ctrl: TestController,
    collectionItemProvider: CollectionItemProvider,
    startTestRunEvent: VscodeEvent<Uri>
) {
    const watchingTests = new Map<
        VscodeTestItem | "ALL",
        TestRunProfile | undefined
    >();
    const queue = new TestRunQueue(ctrl);

    handleTestTreeUpdates(ctrl, collectionItemProvider);

    collectionItemProvider.subscribeToUpdates()(
        async ({ data: { item: changedItem } }) => {
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
                    queue
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
                    queue
                );
            }
        }
    );

    const runHandler = async (
        request: TestRunRequest,
        cancellation: CancellationToken
    ) => {
        if (!request.continuous) {
            return await startTestRun(
                ctrl,
                request,
                collectionItemProvider,
                queue
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

    ctrl.refreshHandler = async () => {
        // ToDo: Remove cached items that are outdated
        await addMissingTestCollectionsAndItemsToTestTree(
            collectionItemProvider
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
                collectionItemProvider
            );
            return;
        }

        // ToDo: if 'item' is not undefined, go through all descendant files and folders of item and refresh state
    };

    startTestRunEvent(async (uri) => {
        let testItem: VscodeTestItem | undefined;

        const found = collectionItemProvider
            .getRegisteredCollections()
            .some((collection) => {
                const maybeItem = collection.getStoredDataForPath(uri.fsPath);

                if (maybeItem) {
                    testItem = maybeItem.testItem;
                    return true;
                }
            });

        if (found) {
            await startTestRun(
                ctrl,
                new TestRunRequest(
                    [testItem as VscodeTestItem],
                    undefined,
                    defaultProfile,
                    false
                ),
                collectionItemProvider,
                queue
            );
        } else {
            window.showInformationMessage(
                "No bruno tests found for selected item."
            );
        }
    });
}

async function addMissingTestCollectionsAndItemsToTestTree(
    collectionItemProvider: CollectionItemProvider
) {
    await collectionItemProvider.registerMissingCollectionsAndTheirItems();
}

function handleTestTreeUpdates(
    controller: TestController,
    collectionItemProvider: CollectionItemProvider
) {
    collectionItemProvider.subscribeToUpdates()(
        ({ collection, data: { testItem }, updateType, changedData }) => {
            if (updateType == FileChangeType.Created && testItem) {
                addTestItemToTestTree(controller, collection, testItem);
            } else if (
                updateType == FileChangeType.Modified &&
                testItem &&
                changedData
            ) {
                /* For directories, no changes are ever registered because renaming a directory is seen as a creation of a new directory with the
                new name and a deletion of the directory with the old name. */
                if (changedData.sequence) {
                    controller.items.delete(getTestId(testItem.uri as Uri));
                    addTestItemToTestTree(controller, collection, testItem);
                } else {
                    // This case can e.g. happen if the sequence in the a .bru file is changed to an invalid value
                    controller.items.delete(getTestId(testItem.uri as Uri));
                }
            } else if (updateType == FileChangeType.Deleted && testItem) {
                const uri = testItem.uri as Uri;

                controller.items.delete(getTestId(uri));

                const parentItem = collection.getStoredDataForPath(
                    dirname(uri.fsPath)
                );
                if (parentItem && parentItem.testItem) {
                    parentItem.testItem.children.delete(getTestId(uri));
                }
            }
        }
    );
}
