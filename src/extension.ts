import * as vscode from "vscode";
import { TestFile } from "./model/testFile";
import { TestCollection } from "./model/testCollection";
import { addTestCollection } from "./vsCodeTestTree/addTestCollection";
import { handleTestFileCreationOrUpdate } from "./vsCodeTestTree/testFileUpdater";
import { getAllCollectionRootDirectories } from "./fileSystem/collectionRootFolderHelper";
import { getCollectionForTest } from "./testTreeHelper";
import { startWatchingWorkspace } from "./vsCodeTestTree/startWatchingWorkspace";
import { addAllTestItemsForCollections } from "./vsCodeTestTree/addAllTestItemsForCollections";
import { startTestRun } from "./testRun/startTestRun";

export async function activate(context: vscode.ExtensionContext) {
    const ctrl = vscode.tests.createTestController(
        "brunoCliTestController",
        "Bruno CLI Tests"
    );
    context.subscriptions.push(ctrl);

    const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
    const watchingTests = new Map<
        vscode.TestItem | "ALL",
        vscode.TestRunProfile | undefined
    >();
    let testCollections: TestCollection[] = await getInitialCollections(ctrl);
    fileChangedEmitter.event((uri) => {
        if (watchingTests.has("ALL")) {
            startTestRun(
                ctrl,
                new vscode.TestRunRequest(
                    undefined,
                    undefined,
                    watchingTests.get("ALL"),
                    true
                ),
                testCollections
            );
            return;
        }

        const include: vscode.TestItem[] = [];
        let profile: vscode.TestRunProfile | undefined;
        for (const [item, thisProfile] of watchingTests) {
            const cast = item as vscode.TestItem;
            if (cast.uri?.toString() == uri.toString()) {
                include.push(cast);
                profile = thisProfile;
            }
        }

        if (include.length) {
            startTestRun(
                ctrl,
                new vscode.TestRunRequest(include, undefined, profile, true),
                testCollections
            );
        }
    });

    const runHandler = (
        request: vscode.TestRunRequest,
        cancellation: vscode.CancellationToken
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
        await addAllTestItemsForCollections(ctrl, testCollections);
    };

    ctrl.createRunProfile(
        "Run Bruno Tests",
        vscode.TestRunProfileKind.Run,
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

    function updateNodeForDocument(e: vscode.TextDocument) {
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

    for (const document of vscode.workspace.textDocuments) {
        updateNodeForDocument(document);
    }

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
        vscode.workspace.onDidChangeTextDocument((e) =>
            updateNodeForDocument(e.document)
        )
    );
}

async function getInitialCollections(controller: vscode.TestController) {
    const collectionRootDirs = await getAllCollectionRootDirectories();
    const result: TestCollection[] = [];

    for (const collectionRoot of collectionRootDirs) {
        result.push(addTestCollection(controller, collectionRoot));
    }

    return result;
}
