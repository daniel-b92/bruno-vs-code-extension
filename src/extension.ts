import {
    EventEmitter,
    ExtensionContext,
    ProgressLocation,
    tests,
    Uri,
    window,
    workspace,
} from "vscode";
import { activateRunner } from "./testRunner";
import { activateTreeView } from "./treeView";
import {
    CollectionWatcher,
    FileChangedEvent,
    CollectionItemProvider,
    TestRunnerDataHelper,
} from "./shared";
import { activateLanguageFeatures } from "./languageFeatures";
import { syncTsPlugin } from "./syncTsPlugin";

export async function activate(context: ExtensionContext) {
    const ctrl = tests.createTestController(
        "bruAsCodeTestController",
        "bru-as-code"
    );
    context.subscriptions.push(ctrl);

    const fileChangedEmitter = new EventEmitter<FileChangedEvent>();
    const collectionWatcher = new CollectionWatcher(
        context,
        fileChangedEmitter
    );

    const collectionItemProvider = new CollectionItemProvider(
        collectionWatcher,
        new TestRunnerDataHelper(ctrl)
    );

    const startTestRunEmitter = new EventEmitter<Uri>();

    await syncTsPlugin();

    workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("typescript")) {
            await syncTsPlugin();
        }
    });

    window.withProgress(
        {
            location: ProgressLocation.Window,
            title: "Starting Bruno test extension...",
        },
        () => {
            return new Promise<void>((resolve) => {
                collectionItemProvider.refreshCache().then(() => {
                    activateRunner(
                        ctrl,
                        collectionItemProvider,
                        startTestRunEmitter.event
                    ).then(() => {
                        activateTreeView(
                            context,
                            collectionItemProvider,
                            startTestRunEmitter
                        );

                        activateLanguageFeatures(
                            context,
                            collectionItemProvider
                        );
                        resolve();
                    });
                });
            });
        }
    );
}
