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
import { CollectionWatcher } from "../shared/fileSystem/collectionWatcher";
import { CollectionItemProvider } from "../shared/state/collectionItemProvider";

export async function activateRunner(
    ctrl: TestController,
    collectionWatcher: CollectionWatcher,
    collectionItemProvider: CollectionItemProvider,
    startTestRunEvent: VscodeEvent<Uri>
) {
    const watchingTests = new Map<
        VscodeTestItem | "ALL",
        TestRunProfile | undefined
    >();
    const queue = new TestRunQueue(ctrl);

    await addMissingTestCollectionsAndItemsToTestTree(collectionItemProvider);

    collectionWatcher.subscribeToUpdates()(async ({ uri }) => {
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

        for (const [item, thisProfile] of watchingTests) {
            const cast = item as VscodeTestItem;

            // If the modified item is a descendant of a watched item, trigger a testrun for that watched item.
            if (
                cast.uri?.fsPath ? uri.fsPath.includes(cast.uri?.fsPath) : false
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
