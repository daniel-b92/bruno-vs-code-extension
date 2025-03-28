import { EventEmitter, ExtensionContext, tests, Uri } from "vscode";
import { activateRunner } from "./testRunner/activateRunner";
import { activateTreeView } from "./treeView/activateTreeView";
import { FileChangedEvent } from "./shared/fileSystem/fileChangesDefinitions";
import { CollectionWatcher } from "./shared/fileSystem/collectionWatcher";
import { activateLanguageFeatures } from "./languageFeatures/activateLanguageFeatures";
import { CollectionItemProvider } from "./shared/state/collectionItemProvider";
import { TestRunnerDataHelper } from "./shared/state/testRunnerDataHelper";

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
    await collectionItemProvider.registerMissingCollectionsAndTheirItems();

    const startTestRunEmitter = new EventEmitter<Uri>();

    await activateRunner(
        ctrl,
        collectionWatcher,
        collectionItemProvider,
        startTestRunEmitter.event
    );
    activateTreeView(collectionItemProvider, startTestRunEmitter);
    activateLanguageFeatures(context);
}
