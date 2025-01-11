import * as vscode from "vscode";
import * as testTree from "./testTreeHelper";
import { TestFile } from "./model/testFile";
import { runTestStructure } from "./runTestStructure";

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
    fileChangedEmitter.event((uri) => {
        if (watchingTests.has("ALL")) {
            startTestRun(
                new vscode.TestRunRequest(
                    undefined,
                    undefined,
                    watchingTests.get("ALL"),
                    true
                )
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
                new vscode.TestRunRequest(include, undefined, profile, true)
            );
        }
    });

    const runHandler = (
        request: vscode.TestRunRequest,
        cancellation: vscode.CancellationToken
    ) => {
        if (!request.continuous) {
            return startTestRun(request);
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

    const startTestRun = (request: vscode.TestRunRequest) => {
        const queue: { test: vscode.TestItem; data: testTree.BrunoTestData }[] =
            [];
        const run = ctrl.createTestRun(request);

        const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
            for (const test of tests) {
                if (request.exclude?.includes(test)) {
                    continue;
                }

                const data = testTree.testData.get(test)!;
                run.enqueued(test);
                queue.push({ test, data });
            }
        };

        const runTestQueue = async () => {
            for (const { test, data } of queue) {
                run.appendOutput(`Running ${test.label}\r\n`);
                if (run.token.isCancellationRequested) {
                    run.appendOutput(`Canceled ${test.label}\r\n`);
                    run.skipped(test);
                } else {
                    run.started(test);
                    await runTestStructure(test, data, run);
                }

                run.appendOutput(`Completed ${test.label}\r\n`);
            }

            run.end();
        };

        discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(
            runTestQueue
        );
    };

    ctrl.refreshHandler = async () => {
        await Promise.all(
            getWorkspaceTestPatterns().map((pattern) =>
                findInitialFilesAndDirectories(ctrl, pattern)
            )
        );
    };

    const runProfile = ctrl.createRunProfile(
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
                ...startWatchingWorkspace(ctrl, fileChangedEmitter)
            );
            return;
        }

        const data = testTree.testData.get(item);
        if (data instanceof TestFile) {
            data.updateFromDisk(item);
        }
    };

    function updateNodeForDocument(e: vscode.TextDocument) {
        testTree.updateNodeForDocument(ctrl, fileChangedEmitter, e);
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

function gatherTestItems(collection: vscode.TestItemCollection) {
    const items: vscode.TestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}

function getWorkspaceTestPatterns() {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }

    return vscode.workspace.workspaceFolders.map(
        (workspaceFolder) =>
            new vscode.RelativePattern(
                workspaceFolder,
                testTree.globPatternForTestfiles
            )
    );
}

async function findInitialFilesAndDirectories(
    controller: vscode.TestController,
    pattern: vscode.GlobPattern
) {
    const relevantFiles = await vscode.workspace.findFiles(pattern);
    await testTree.createAllTestitemsForCollection(
        controller,
        testTree.getCollectionRootDir(relevantFiles[0].fsPath)
    );
}

function startWatchingWorkspace(
    controller: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>
) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate((uri) => {
            testTree.getOrCreateFile(controller, uri);
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidChange(async (uri) => {
            const maybeFile = testTree.getOrCreateFile(controller, uri);
            if (!maybeFile) {
                testTree.removeTestFile(controller, fileChangedEmitter, uri);
            } else {
                maybeFile.testFile.updateFromDisk(maybeFile.testItem);

                const parentItem = testTree.updateParentItem(
                    maybeFile.testItem
                );
                fileChangedEmitter.fire(uri);
                if (parentItem) {
                    fileChangedEmitter.fire(parentItem.uri!);
                }
            }
        });
        watcher.onDidDelete((uri) => {
            testTree.removeTestFile(controller, fileChangedEmitter, uri);
        });

        findInitialFilesAndDirectories(controller, pattern);

        return watcher;
    });
}
