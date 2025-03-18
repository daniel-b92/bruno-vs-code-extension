import { EventEmitter, ExtensionContext, tests, Uri } from "vscode";
import { activateRunner } from "./testRunner/activateRunner";
import { activateTreeView } from "./treeView/activateTreeView";
import { FileChangedEvent } from "./shared/fileChangesDefinitions";
import { CollectionWatcher } from "./shared/fileSystem/collectionWatcher";
import { activateLanguageFeatures } from "./languageFeatures/activateLanguageFeatures";

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

    const startTestRunEmitter = new EventEmitter<Uri>();
    await activateRunner(ctrl, collectionWatcher, startTestRunEmitter.event);
    activateTreeView(collectionWatcher, startTestRunEmitter);
    activateLanguageFeatures(context);
}
