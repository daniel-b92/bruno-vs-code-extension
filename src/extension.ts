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
    workspace,
    window,
    languages,
    CompletionItem,
    CompletionItemKind,
} from "vscode";
import { addTestCollectionToTestTree } from "./testRunner/vsCodeTestTree/testItemAdding/addTestCollection";
import { getAllCollectionRootDirectories } from "./shared/fileSystem/collectionRootFolderHelper";
import { getCollectionForTest } from "./testRunner/vsCodeTestTree/utils/testTreeHelper";
import { addAllTestItemsForCollections } from "./testRunner/vsCodeTestTree/testItemAdding/addAllTestItemsForCollections";
import { startTestRun } from "./testRunner/testRun/startTestRun";
import { existsSync } from "fs";
import { handleTestItemDeletion } from "./testRunner/vsCodeTestTree/handlers/handleTestItemDeletion";
import { CollectionRegistry } from "./testRunner/vsCodeTestTree/collectionRegistry";
import { TestDirectory } from "./testRunner/testData/testDirectory";
import { addTestDirectoryAndAllDescendants } from "./testRunner/vsCodeTestTree/testItemAdding/addTestDirectoryAndAllDescendants";
import { TestRunQueue } from "./testRunner/testRun/testRunQueue";
import { BrunoTestDataProvider } from "./treeView/brunoTestDataProvider";

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
    const collectionRegistry = new CollectionRegistry(
        ctrl,
        context,
        fileChangedEmitter
    );
    const queue = new TestRunQueue(ctrl);

    await addMissingTestCollectionsToTestTree(ctrl, collectionRegistry);

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
                collectionRegistry.getCurrentCollections(),
                queue
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
                collectionRegistry.getCurrentCollections(),
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
                collectionRegistry.getCurrentCollections(),
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
        collectionRegistry.getCurrentCollections().forEach((collection) => {
            if (existsSync(collection.rootDirectory)) {
                Array.from(collection.testData.keys()).forEach((testItem) => {
                    if (testItem.uri && !existsSync(testItem.uri.fsPath)) {
                        handleTestItemDeletion(ctrl, collection, testItem.uri!);
                    }
                });
            } else {
                collectionRegistry.unregisterCollection(collection);
            }
        });
        await addMissingTestCollectionsToTestTree(ctrl, collectionRegistry);
        await addAllTestItemsForCollections(
            ctrl,
            collectionRegistry.getCurrentCollections()
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
                collectionRegistry.getCurrentCollections()
            );
            return;
        }

        const collection = getCollectionForTest(
            item.uri!,
            collectionRegistry.getCurrentCollections()
        );
        const data = collection.testData.get(item);
        if (data instanceof TestDirectory) {
            await addTestDirectoryAndAllDescendants(ctrl, collection, data);
        }
    };

    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        window.registerTreeDataProvider(
            "brunoCollections",
            new BrunoTestDataProvider(workspace.workspaceFolders[0].uri.fsPath)
        );
    }

    languages.registerCompletionItemProvider(
        { scheme: "file", pattern: "**/*.bru" },
        {
            provideCompletionItems() {
                return {
                    items: [
                        new CompletionItem(
                            `meta {
}`,
                            CompletionItemKind.Field
                        ),
                        new CompletionItem(
                            `tests {
}`,
                            CompletionItemKind.Field
                        ),
                    ],
                };
            },
        }
    );
}

async function addMissingTestCollectionsToTestTree(
    controller: TestController,
    register: CollectionRegistry
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
