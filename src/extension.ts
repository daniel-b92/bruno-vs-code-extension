import {
    EventEmitter,
    ExtensionContext,
    TestController,
    tests,
    Uri,
    workspace,
    TestItem as vscodeTestItem,
    TestRunProfile,
    TestRunRequest,
    CancellationToken,
    TestRunProfileKind,
    TextDocument,
} from "vscode";
import { TestFile } from "./model/testFile";
import { addTestCollectionToTestTree } from "./vsCodeTestTree/testItemAdding/addTestCollection";
import { handleTestFileCreationOrUpdate } from "./vsCodeTestTree/handlers/handleTestFileCreationOrUpdate";
import { getAllCollectionRootDirectories } from "./fileSystem/collectionRootFolderHelper";
import { getCollectionForTest, getTestId } from "./testTreeHelper";
import { startWatchingRegisteredCollections } from "./watchers/startWatchingRegisteredCollections";
import { addAllTestItemsForCollections } from "./vsCodeTestTree/testItemAdding/addAllTestItemsForCollections";
import { startTestRun } from "./testRun/startTestRun";
import { existsSync } from "fs";
import { handleTestItemDeletion } from "./vsCodeTestTree/handlers/handleTestItemDeletion";
import { isValidTestFileFromCollections } from "./vsCodeTestTree/utils/isValidTestFileFromCollections";
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
    const collectionRegister = new CollectionRegister([]);
    const oldestItemInQueueChangedEmitter = new EventEmitter<QueuedTestRun>();
    const queue = new TestRunQueue(oldestItemInQueueChangedEmitter);
    await addMissingTestCollectionsToTestTree(ctrl, collectionRegister);
    fileChangedEmitter.event((uri) => {
        if (watchingTests.has("ALL")) {
            startTestRun(
                ctrl,
                new TestRunRequest(
                    undefined,
                    undefined,
                    watchingTests.get("ALL"),
                    true
                ),
                collectionRegister.getCurrentCollections(),
                queue,
                oldestItemInQueueChangedEmitter
            );
            return;
        }

        const include: vscodeTestItem[] = [];
        let profile: TestRunProfile | undefined;
        for (const [item, thisProfile] of watchingTests) {
            const cast = item as vscodeTestItem;
            if (cast.uri?.toString() == uri.toString()) {
                include.push(cast);
                profile = thisProfile;
            }
        }

        if (include.length) {
            startTestRun(
                ctrl,
                new TestRunRequest(include, undefined, profile, true),
                collectionRegister.getCurrentCollections(),
                queue,
                oldestItemInQueueChangedEmitter
            );
        }
    });

    const runHandler = (
        request: TestRunRequest,
        cancellation: CancellationToken
    ) => {
        if (!request.continuous) {
            return startTestRun(
                ctrl,
                request,
                collectionRegister.getCurrentCollections(),
                queue,
                oldestItemInQueueChangedEmitter
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
                ctrl.items.delete(
                    getTestId(Uri.file(collection.rootDirectory))
                );
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
            const watchers = await startWatchingRegisteredCollections(
                ctrl,
                fileChangedEmitter,
                collectionRegister
            );
            context.subscriptions.push(...watchers);
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

    function updateNodeForDocument(e: TextDocument) {
        if (
            !isValidTestFileFromCollections(
                e.uri,
                collectionRegister.getCurrentCollections()
            )
        ) {
            return;
        }

        handleTestFileCreationOrUpdate(
            ctrl,
            getCollectionForTest(
                e.uri,
                collectionRegister.getCurrentCollections()
            ),
            e.uri
        );
        fileChangedEmitter.fire(e.uri);
    }

    for (const document of workspace.textDocuments) {
        updateNodeForDocument(document);
    }

    context.subscriptions.push(
        workspace.onDidOpenTextDocument(updateNodeForDocument),
        workspace.onDidChangeTextDocument((e) =>
            updateNodeForDocument(e.document)
        )
    );
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
