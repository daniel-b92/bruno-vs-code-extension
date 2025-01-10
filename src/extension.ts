import * as vscode from "vscode";
import {
    BrunoTestData,
    getCollectionRootDir,
    getTestfilesForCollection,
    getTestId,
    getTestLabel,
    globPatternForTestfiles,
    runTestStructure,
    testData,
    TestDirectory,
    TestFile,
} from "./testTree";
import { dirname } from "path";
import { getSequence } from "./parser";

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
                if (!data.didResolve) {
                    await data.updateFromDisk(ctrl, test);
                }
                run.enqueued(test);
                queue.push({ test, data });
            }
        };

        const runTestQueue = async () => {
            for (const { test, data } of queue) {
                run.appendOutput(`Running ${test.id}\r\n`);
                if (run.token.isCancellationRequested) {
                    run.skipped(test);
                } else {
                    run.started(test);
                    await runTestStructure(test, data, run);
                }

                run.appendOutput(`Completed ${test.id}\r\n`);
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

    ctrl.createRunProfile(
        "Run Tests",
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

        const data = testData.get(item);
        if (data instanceof TestFile) {
            await data.updateFromDisk(ctrl, item);
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
        testFile.updateFromContents(ctrl, testItem);
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
    const existing = controller.items.get(getTestId(uri));
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
    controller.items.add(testItem);

    const filePath = testItem.uri?.fsPath!;
    const testFile = new TestFile(filePath, getSequence(filePath));
    testData.set(testItem, testFile);

    testItem.canResolveChildren = false;
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

    const relevantFiles = await getTestfilesForCollection(collectionRootDir);
    let currentPaths: PathWithChildren[] = relevantFiles.map((path) => ({
        path: path.fsPath,
        childItems: [],
    }));
    let currentTestItems: vscode.TestItem[];

    while (currentPaths.length > 0) {
        currentTestItems = [];

        currentPaths.forEach(({ path, childItems }) => {
            const uri = vscode.Uri.file(path);
            const testItem =
                controller.items.get(getTestId(uri)) ??
                controller.createTestItem(
                    getTestId(uri),
                    getTestLabel(uri),
                    uri
                );

            controller.items.add(testItem);
            childItems.forEach((childItem) => testItem.children.add(childItem));
            currentTestItems.push(testItem);

            if (childItems.length > 0) {
                testItem.canResolveChildren = true;
                testData.set(testItem, new TestDirectory(path));
            } else {
                testItem.canResolveChildren = false;
                const sequence = getSequence(path);
                testItem.sortText = sequence.toString();
                testData.set(testItem, new TestFile(path, getSequence(path)));
            }
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
            if (testFile.didResolve) {
                await testFile.updateFromDisk(controller, testItem);
            }
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidDelete((uri) => controller.items.delete(uri.toString()));

        findInitialFilesAndDirectories(controller, pattern);

        return watcher;
    });
}
