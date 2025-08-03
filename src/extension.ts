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
    getTemporaryJsFileName,
    OutputChannelLogger,
} from "./shared";
import { activateLanguageFeatures } from "./languageFeatures";
import { suggestCreatingTsConfigsForCollections } from "./languageFeatures/suggestCreatingTsConfigsForCollections";

export async function activate(context: ExtensionContext) {
    const extensionNameLabel = "BruAsCode";

    const ctrl = tests.createTestController(
        "bruAsCodeTestController",
        extensionNameLabel,
    );
    context.subscriptions.push(ctrl);

    const logger = new OutputChannelLogger(
        window.createOutputChannel(extensionNameLabel, { log: true }),
    );

    context.subscriptions.push(logger);

    const fileChangedEmitter = new EventEmitter<FileChangedEvent>();
    const collectionWatcher = new CollectionWatcher(
        context,
        fileChangedEmitter,
        logger,
    );

    const collectionItemProvider = new CollectionItemProvider(
        collectionWatcher,
        new TestRunnerDataHelper(ctrl),
        getPathsToIgnoreForCollection,
        logger,
    );

    const startTestRunEmitter = new EventEmitter<Uri>();

    window.withProgress(
        {
            location: ProgressLocation.Window,
            title: "Starting bru-as-code extension...",
        },
        () => {
            return new Promise<void>((resolve) => {
                collectionItemProvider.refreshCache().then(() => {
                    activateRunner(
                        context,
                        ctrl,
                        collectionItemProvider,
                        startTestRunEmitter.event,
                    ).then(() => {
                        activateTreeView(
                            context,
                            collectionItemProvider,
                            startTestRunEmitter,
                        );

                        activateLanguageFeatures(
                            context,
                            collectionItemProvider,
                        );

                        resolve();

                        suggestCreatingTsConfigsForCollections(
                            collectionItemProvider,
                        );
                    });
                });
            });
        },
    );
}

function getPathsToIgnoreForCollection(collectionRootDirectory: string) {
    return [getTemporaryJsFileName(collectionRootDirectory)];
}
