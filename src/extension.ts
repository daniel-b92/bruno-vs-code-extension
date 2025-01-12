import * as vscode from "vscode";
import * as testTree from "./testTreeHelper";
import { TestFile } from "./model/testFile";
import { environmentConfigKey, runTestStructure } from "./runTestStructure";
import { getHtmlReportPath, showHtmlReport } from "./htmlReportHelper";
import { TestCollection } from "./model/testCollection";
import { existsSync } from "fs";

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

                const collection = testTree.getCollectionForTest(
                    test.uri!,
                    testCollections
                );
                const data = collection.testData.get(test)!;
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
                    const testEnvironment = vscode.workspace
                        .getConfiguration()
                        .get(environmentConfigKey) as string | undefined;
                    const htmlReportPath = getHtmlReportPath(
                        await testTree.getCollectionRootDir(data.path)
                    );
                    if (!testEnvironment) {
                        run.appendOutput(
                            `Not using any environment for the test run.\r\n`
                        );
                        run.appendOutput(
                            `You can configure an environment to use via the setting '${environmentConfigKey}'.\r\n`
                        );
                    } else {
                        run.appendOutput(
                            `Using the test environment '${testEnvironment}'.\r\n`
                        );
                    }
                    run.appendOutput(
                        `Saving the HTML test report to file '${htmlReportPath}'.\r\n`
                    );
                    await runTestStructure(test, data, run, testEnvironment);
                    if (existsSync(htmlReportPath)) {
                        showHtmlReport(htmlReportPath, data);
                    }
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
        await findInitialFilesAndDirectories(ctrl, testCollections);
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

        const collection = testTree.getCollectionForTest(
            item.uri!,
            testCollections
        );
        const data = collection.testData.get(item);
        if (data instanceof TestFile) {
            data.updateFromDisk(item, collection);
        }
    };

    function updateNodeForDocument(e: vscode.TextDocument) {
        testTree.updateNodeForDocument(
            ctrl,
            fileChangedEmitter,
            e,
            testCollections
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
    testCollections: TestCollection[]
) {
    for (const collection of testCollections) {
        await testTree.addAllTestitemsToTestTree(controller, collection);
    }
}

function startWatchingWorkspace(
    controller: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
    testCollections: TestCollection[]
) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate((uri) => {
            const collection = testTree.getCollectionForTest(
                uri,
                testCollections
            );
            testTree.getOrCreateFile(controller, uri, collection);
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidChange(async (uri) => {
            const collection = testTree.getCollectionForTest(
                uri,
                testCollections
            );
            const maybeFile = testTree.getOrCreateFile(
                controller,
                uri,
                collection
            );
            if (!maybeFile) {
                testTree.removeTestFile(
                    controller,
                    fileChangedEmitter,
                    uri,
                    collection
                );
            } else {
                maybeFile.testFile.updateFromDisk(
                    maybeFile.testItem,
                    collection
                );

                const parentItem = testTree.updateParentItem(
                    maybeFile.testItem,
                    collection
                );
                fileChangedEmitter.fire(uri);
                if (parentItem) {
                    fileChangedEmitter.fire(parentItem.uri!);
                }
            }
        });
        watcher.onDidDelete((uri) => {
            const collection = testTree.getCollectionForTest(
                uri,
                testCollections
            );
            testTree.removeTestFile(
                controller,
                fileChangedEmitter,
                uri,
                collection
            );
        });

        findInitialFilesAndDirectories(controller, testCollections);

        return watcher;
    });
}

async function getInitialCollections(controller: vscode.TestController) {
    const collectionRootDirs = await testTree.getAllCollectionRootDirectories();
    const result: TestCollection[] = [];

    for (const collectionRoot of collectionRootDirs) {
        const uri = vscode.Uri.file(collectionRoot);
        const collectionItem = controller.createTestItem(
            testTree.getTestId(uri),
            testTree.getTestLabel(uri),
            uri
        );

        const collection = new TestCollection(collectionRoot, collectionItem);
        collectionItem.canResolveChildren = true;
        controller.items.add(collectionItem);
        result.push(collection);
    }

    return result;
}
