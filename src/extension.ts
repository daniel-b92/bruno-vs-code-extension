import * as vscode from "vscode";
import {
    BrunoTestData,
    getCollectionRootDir,
    getParentItem,
    getSortText,
    getTestfileDescendants,
    getTestId,
    getTestLabel,
    globPatternForTestfiles,
    testData,
    updateParentItem,
} from "./testTreeHelper";
import { dirname } from "path";
import { getSequence } from "./parser";
import { lstatSync } from "fs";
import { TestFile } from "./model/testFile";
import { TestDirectory } from "./model/testDirectory";
import { runTestStructure } from "./runTestStructure";

export async function activate(context: vscode.ExtensionContext) {
    const ctrl = vscode.tests.createTestController(
        "brunoCliTestController",
        "Bruno CLI Test"
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
        const queue: { test: vscode.TestItem; data: BrunoTestData }[] = [];
        const run = ctrl.createTestRun(request);

        const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
            for (const test of tests) {
                if (request.exclude?.includes(test)) {
                    continue;
                }

                const data = testData.get(test)!;
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
    runProfile.configureHandler = () => {};

    ctrl.resolveHandler = async (item) => {
        if (!item) {
            context.subscriptions.push(
                ...startWatchingWorkspace(ctrl, fileChangedEmitter)
            );
            return;
        }

        const data = testData.get(item);
        if (data instanceof TestFile) {
            data.updateFromDisk(ctrl, item);
        }
    };

    function updateNodeForDocument(e: vscode.TextDocument) {
        if (e.uri.scheme !== "file") {
            return;
        }

        if (!e.uri.path.endsWith(".bru")) {
            return;
        }

        const { testItem, testFile } = getOrCreateFile(ctrl, e.uri);
        testFile.updateFromDisk(ctrl, testItem);
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

function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
    const existing = Array.from(testData.keys()).find(
        (item) => item.uri?.fsPath == uri.fsPath
    );
    if (existing) {
        return {
            testItem: existing,
            testFile: testData.get(existing) as TestFile,
        };
    }

    const testItem = controller.createTestItem(
        getTestId(uri),
        getTestLabel(uri),
        uri
    );

    const filePath = testItem.uri?.fsPath!;
    const testFile = new TestFile(filePath, getSequence(filePath));

    testItem.canResolveChildren = false;
    testItem.sortText = getSortText(testFile);
    controller.items.add(testItem);
    const parentItem = Array.from(testData.keys()).find(
        (item) => dirname(filePath) == item.uri?.fsPath
    );
    if (parentItem) {
        parentItem.children.add(testItem);
    }

    testData.set(testItem, testFile);
    return { testItem, testFile };
}

async function createAllTestitemsForCollection(
    controller: vscode.TestController,
    collectionRootDir: string
) {
    type PathWithChildren = {
        path: string;
        childItems: vscode.TestItem[];
    };

    const getUniquePaths = (arr: PathWithChildren[]) => {
        let result: PathWithChildren[] = [];

        arr.forEach(({ path, childItems }) => {
            if (!result.some((val) => val.path == path)) {
                result.push({ path, childItems });
            } else {
                const arrayIndex = result.findIndex((val) => val.path == path);
                result[arrayIndex] = {
                    path,
                    childItems:
                        result[arrayIndex].childItems.concat(childItems),
                };
            }
        });

        return result;
    };

    const switchToParentDirectory = (
        pathsWithChildren: PathWithChildren[],
        currentTestItems: vscode.TestItem[]
    ) => {
        const parentsWithDuplicatePaths: PathWithChildren[] = pathsWithChildren
            .map(({ path }) => {
                const parentPath = dirname(path);
                const childTestItem = currentTestItems.find(
                    (item) => item.uri?.fsPath == path
                );
                return {
                    path: parentPath,
                    childItems: childTestItem ? [childTestItem] : [],
                };
            })
            .filter(({ path }) => path.includes(collectionRootDir));

        return getUniquePaths(parentsWithDuplicatePaths);
    };

    const relevantFiles = await getTestfileDescendants(collectionRootDir);
    let currentPaths: PathWithChildren[] = relevantFiles.map((path) => ({
        path: path.fsPath,
        childItems: [],
    }));
    let currentTestItems: vscode.TestItem[];

    while (currentPaths.length > 0) {
        currentTestItems = [];

        currentPaths.forEach(({ path, childItems }) => {
            const uri = vscode.Uri.file(path);
            const isFile = lstatSync(path).isFile();
            let testItem: vscode.TestItem | undefined;

            if (!isFile) {
                testItem = Array.from(testData.keys()).find(
                    (item) => item.uri?.fsPath == path
                );

                if (!testItem) {
                    testItem = controller.createTestItem(
                        getTestId(uri),
                        getTestLabel(uri),
                        uri
                    );
                    controller.items.add(testItem);
                    testItem.canResolveChildren = true;
                    const testDir = new TestDirectory(path);
                    testData.set(testItem, testDir);
                }

                childItems.forEach((childItem) =>
                    testItem!.children.add(childItem)
                );
            } else {
                testItem = controller.createTestItem(
                    getTestId(uri),
                    getTestLabel(uri),
                    uri
                );
                const testFile = new TestFile(path, getSequence(path));
                testItem.sortText = getSortText(testFile);
                controller.items.add(testItem);
                testData.set(testItem, testFile);
            }
            currentTestItems.push(testItem);
        });

        currentPaths = switchToParentDirectory(currentPaths, currentTestItems);
    }
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
            new vscode.RelativePattern(workspaceFolder, globPatternForTestfiles)
    );
}

async function findInitialFilesAndDirectories(
    controller: vscode.TestController,
    pattern: vscode.GlobPattern
) {
    const relevantFiles = await vscode.workspace.findFiles(pattern);
    createAllTestitemsForCollection(
        controller,
        getCollectionRootDir(relevantFiles[0].fsPath)
    );
}

function startWatchingWorkspace(
    controller: vscode.TestController,
    fileChangedEmitter: vscode.EventEmitter<vscode.Uri>
) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate((uri) => {
            getOrCreateFile(controller, uri);
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidChange(async (uri) => {
            const { testItem, testFile } = getOrCreateFile(controller, uri);
            testFile.updateFromDisk(controller, testItem);

            const parentItem = updateParentItem(testItem);
            fileChangedEmitter.fire(uri);
            if (parentItem) {
                fileChangedEmitter.fire(parentItem.uri!);
            }
        });
        watcher.onDidDelete((uri) => {
            controller.items.delete(getTestId(uri));
            fileChangedEmitter.fire(uri);

            const parentItem = getParentItem(uri);
            if (parentItem) {
                parentItem.children.delete(getTestId(uri));
                fileChangedEmitter.fire(parentItem.uri!);
            }
            const keyToDelete = Array.from(testData.keys()).find(
                (item) => item.uri == uri
            );
            if (keyToDelete) {
                testData.delete(keyToDelete);
            }
        });

        findInitialFilesAndDirectories(controller, pattern);

        return watcher;
    });
}
