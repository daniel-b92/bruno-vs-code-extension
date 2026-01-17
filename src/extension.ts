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
    OutputChannelLogger,
    getTemporaryJsFileBasenameWithoutExtension,
    MultiFileOperationWithStatus,
} from "./shared";
import { activateLanguageFeatures } from "./languageFeatures";
import { suggestCreatingTsConfigsForCollections } from "./languageFeatures/suggestCreatingTsConfigsForCollections";

export async function activate(context: ExtensionContext) {
    const extensionNameLabel = "BruAsCode";

    const ctrl = tests.createTestController(
        "bruAsCodeTestController",
        extensionNameLabel,
    );

    const logger = new OutputChannelLogger(
        window.createOutputChannel(extensionNameLabel, { log: true }),
    );

    const fileChangedEmitter = new EventEmitter<FileChangedEvent>();
    const collectionWatcher = new CollectionWatcher(
        context,
        fileChangedEmitter,
        logger,
    );

    const multiFileOperationNotifier =
        new EventEmitter<MultiFileOperationWithStatus>();

    const testRunnerDataHelper = new TestRunnerDataHelper(ctrl);
    const collectionItemProvider = new CollectionItemProvider(
        collectionWatcher,
        testRunnerDataHelper,
        getPathsToIgnoreForCollections(),
        multiFileOperationNotifier.event,
        logger,
    );

    const startTestRunEmitter = new EventEmitter<{
        uri: Uri;
        withDialog: boolean;
    }>();

    context.subscriptions.push(
        startTestRunEmitter,
        fileChangedEmitter,
        multiFileOperationNotifier,
        collectionItemProvider,
        collectionWatcher,
        testRunnerDataHelper,
        logger,
        ctrl,
    );

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
                            multiFileOperationNotifier,
                        );

                        activateLanguageFeatures(
                            context,
                            collectionWatcher,
                            collectionItemProvider,
                            startTestRunEmitter.event,
                        ).then(() => {
                            resolve();

                            suggestCreatingTsConfigsForCollections(
                                collectionItemProvider,
                            );
                        });
                    });
                });
            });
        },
    );
}

function getPathsToIgnoreForCollections() {
    return [
        new RegExp(
            `(/|\\\\)${getTemporaryJsFileBasenameWithoutExtension()}\\.js`,
        ),
    ];
}
