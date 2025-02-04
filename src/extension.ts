import {
    EventEmitter,
    ExtensionContext,
    TestController,
    tests,
    Uri,
    TestItem as vscodeTestItem,
    TestRunProfile,
    TestRunRequest,
    CancellationToken,
    TestRunProfileKind,
} from "vscode";
import { addTestCollectionToTestTree } from "./vsCodeTestTree/testItemAdding/addTestCollection";
import { getAllCollectionRootDirectories } from "./fileSystem/collectionRootFolderHelper";
import { getCollectionForTest } from "./testTreeHelper";
import { addAllTestItemsForCollections } from "./vsCodeTestTree/testItemAdding/addAllTestItemsForCollections";
import { startTestRun } from "./testRun/startTestRun";
import { existsSync } from "fs";
import { handleTestItemDeletion } from "./vsCodeTestTree/handlers/handleTestItemDeletion";
import { CollectionRegister } from "./model/collectionRegister";
import { TestDirectory } from "./model/testDirectory";
import { addTestDirectoryAndAllDescendants } from "./vsCodeTestTree/testItemAdding/addTestDirectoryAndAllDescendants";
import { QueuedTestRun, TestRunQueue } from "./model/testRunQueue";

export async function activate(context: ExtensionContext) {
    const ctrl = tests.createTestController(
        "brunoCliTestController",
        "Bruno CLI Tests"
    );
    context.subscriptions.push(ctrl);

    const fileChangedEmitter = new EventEmitter<Uri>();
    const watchingTests = new Map<
        vscodeTestItem | "ALL",
        TestRunProfile | undefined
    >();
    const collectionRegister = new CollectionRegister(
        ctrl,
        context,
        fileChangedEmitter
    );
    const canStartTestRunEmitter = new EventEmitter<QueuedTestRun>();
    const queue = new TestRunQueue(canStartTestRunEmitter);

    await addMissingTestCollectionsToTestTree(ctrl, collectionRegister);

    fileChangedEmitter.event(async (uri) => {
        if (watchingTests.has("ALL")) {
            await startTestRun(
                ctrl,
                new TestRunRequest(
                    undefined,
                    undefined,
                    watchingTests.get("ALL"),
                    true
                ),
                collectionRegister.getCurrentCollections(),
                queue,
                canStartTestRunEmitter
            );
            return;
        }

        const include: vscodeTestItem[] = [];
        let profile: TestRunProfile | undefined;

        for (const [item, thisProfile] of watchingTests) {
            const cast = item as vscodeTestItem;

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
                collectionRegister.getCurrentCollections(),
                queue,
                canStartTestRunEmitter
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
                collectionRegister.getCurrentCollections(),
                queue,
                canStartTestRunEmitter
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
        collectionRegister.getCurrentCollections().forEach((collection) => {
            if (existsSync(collection.rootDirectory)) {
                Array.from(collection.testData.keys()).forEach((testItem) => {
                    if (!existsSync(testItem.uri?.fsPath!)) {
                        handleTestItemDeletion(ctrl, collection, testItem.uri!);
                    }
                });
            } else {
                collectionRegister.unregisterCollection(collection);
            }
        });
        await addMissingTestCollectionsToTestTree(ctrl, collectionRegister);
        await addAllTestItemsForCollections(
            ctrl,
            collectionRegister.getCurrentCollections()
        );
    };

    ctrl.createRunProfile(
        "Run Bruno Tests",
        TestRunProfileKind.Run,
        runHandler,
        true,
        undefined,
        true
    );

    ctrl.resolveHandler = async (item) => {
        if (!item) {
            await addAllTestItemsForCollections(
                ctrl,
                collectionRegister.getCurrentCollections()
            );
            return;
        }

        const collection = getCollectionForTest(
            item.uri!,
            collectionRegister.getCurrentCollections()
        );
        const data = collection.testData.get(item);
        if (data instanceof TestDirectory) {
            await addTestDirectoryAndAllDescendants(ctrl, collection, data);
        }
    };
}

async function addMissingTestCollectionsToTestTree(
    controller: TestController,
    register: CollectionRegister
) {
    const collectionRootDirs = await getAllCollectionRootDirectories();

    collectionRootDirs
        .filter(
            (dir) =>
                !register
                    .getCurrentCollections()
                    .some((collection) => collection.rootDirectory == dir)
        )
        .forEach((toAdd) =>
            register.registerCollection(
                addTestCollectionToTestTree(controller, toAdd)
            )
        );
}
