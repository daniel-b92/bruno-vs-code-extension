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
import { TestCollection } from "./model/testCollection";
import { addTestCollectionToTestTree } from "./vsCodeTestTree/addTestCollection";
import { handleTestFileCreationOrUpdate } from "./vsCodeTestTree/handleTestFileCreationOrUpdate";
import { getAllCollectionRootDirectories } from "./fileSystem/collectionRootFolderHelper";
import { getCollectionForTest } from "./testTreeHelper";
import { startWatchingWorkspace } from "./vsCodeTestTree/startWatchingWorkspace";
import { addAllTestItemsForCollections } from "./vsCodeTestTree/addAllTestItemsForCollections";
import { startTestRun } from "./testRun/startTestRun";
import { existsSync } from "fs";
import { handleTestItemDeletion } from "./vsCodeTestTree/handleTestItemDeletion";

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
    const testCollections: TestCollection[] =
        await addTestCollectionsToTestTree(ctrl);
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
                testCollections
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
                testCollections
            );
        }
    });

    const runHandler = (
        request: TestRunRequest,
        cancellation: CancellationToken
    ) => {
        if (!request.continuous) {
            return startTestRun(ctrl, request, testCollections);
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
        testCollections.forEach((collection) => {
            Array.from(collection.testData.keys()).forEach((testItem) => {
                if (!existsSync(testItem.uri?.fsPath!)) {
                    handleTestItemDeletion(
                        ctrl,
                        collection,
                        fileChangedEmitter,
                        testItem.uri!
                    );
                }
            });
        });
        await addAllTestItemsForCollections(ctrl, testCollections);
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
            context.subscriptions.push(
                ...startWatchingWorkspace(
                    ctrl,
                    fileChangedEmitter,
                    testCollections
                )
            );
            return;
        }

        const collection = getCollectionForTest(item.uri!, testCollections);
        const data = collection.testData.get(item);
        if (data instanceof TestFile) {
            data.updateFromDisk(item, collection);
        }
    };

    function updateNodeForDocument(e: TextDocument) {
        if (e.uri.scheme !== "file" || !e.uri.path.endsWith(".bru")) {
            return;
        }

        handleTestFileCreationOrUpdate(
            ctrl,
            fileChangedEmitter,
            getCollectionForTest(e.uri, testCollections),
            e.uri
        );
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

async function addTestCollectionsToTestTree(controller: TestController) {
    const collectionRootDirs = await getAllCollectionRootDirectories();
    const result: TestCollection[] = [];

    for (const collectionRoot of collectionRootDirs) {
        result.push(addTestCollectionToTestTree(controller, collectionRoot));
    }

    return result;
}
