import { EventEmitter, ExtensionContext, tests, Uri } from "vscode";
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

    await collectionItemProvider.refreshState();

    const startTestRunEmitter = new EventEmitter<Uri>();

    await activateRunner(
        ctrl,
        collectionItemProvider,
        startTestRunEmitter.event
    );
    activateTreeView(collectionItemProvider, startTestRunEmitter);

    activateLanguageFeatures(context, collectionItemProvider);
}
