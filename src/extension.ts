import {
    EventEmitter,
    ExtensionContext,
    ProgressLocation,
    tests,
    Uri,
    window,
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

export async function activate(context: ExtensionContext) {
    const ctrl = tests.createTestController(
        "brunoCliTestController",
        "Bruno CLI Tests"
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

    window.withProgress(
        {
            location: ProgressLocation.Window,
            title: "Starting Bruno test extension...",
        },
        () => {
            return new Promise<void>((resolve) => {
                collectionItemProvider.refreshState().then(() => {
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
