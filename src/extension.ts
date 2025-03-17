import { EventEmitter, ExtensionContext, tests } from "vscode";
import { activateRunner } from "./testRunner/activateRunner";
import { activateTreeView } from "./treeView/activateTreeView";
import { FileChangedEvent } from "./shared/definitions";
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

    await activateRunner(ctrl, collectionWatcher);
    activateTreeView(collectionWatcher);
    activateLanguageFeatures();
}
