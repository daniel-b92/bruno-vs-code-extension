import { EventEmitter, ExtensionContext, tests, Uri } from "vscode";
import { activateRunner } from "./testRunner/activateRunner";
import { activateTreeView } from "./treeView/activateTreeView";
import { FileChangedEvent } from "./shared/fileSystem/fileChangesDefinitions";
import { CollectionWatcher } from "./shared/fileSystem/collectionWatcher";
import { activateLanguageFeatures } from "./languageFeatures/activateLanguageFeatures";
import { CollectionItemProvider } from "./shared/state/collectionItemProvider";

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
        collectionWatcher
    );
    await collectionItemProvider.registerAllCollectionsAndTheirItems();

    const startTestRunEmitter = new EventEmitter<Uri>();

    await activateRunner(ctrl, collectionWatcher, startTestRunEmitter.event);
    activateTreeView(
        collectionWatcher,
        collectionItemProvider,
        startTestRunEmitter
    );
    activateLanguageFeatures(context);
}
