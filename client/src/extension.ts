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
    CollectionItemProvider,
    TestRunnerDataHelper,
    OutputChannelLogger,
    MultiFileOperationWithStatus,
    AdditionalCollectionData,
} from "./shared";
import { activateLanguageFeatures } from "./languageFeatures";
import { suggestCreatingTsConfigsForCollections } from "./languageFeatures/suggestCreatingTsConfigsForCollections";
import { join } from "path";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";
import { Evt } from "evt";
import {
    CollectionWatcher,
    FileChangedEvent,
    getTemporaryJsFileBasenameWithoutExtension,
    CollectionItem,
    isRequestFile,
    isCollectionItemWithSequence,
} from "@global_shared";
import { BrunoTreeItem } from "./treeView/brunoTreeItem";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    client = createLanguagClient(context);
    // Start the client. This will also launch the server
    client.start();

    const {
        collectionItemProvider,
        testController: ctrl,
        startTestRunEmitter,
        multiFileOperationNotifier,
        collectionWatcher,
    } = createNeededHandlers(context);

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

export function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

function createLanguagClient(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        join("server", "dist", "server.js"),
    );

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: "file", language: "bru" }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
        },
    };

    const clientId = `${getExtensionNameLabel()}_LanguageClient`;

    return new LanguageClient(clientId, clientId, serverOptions, clientOptions);
}

function createNeededHandlers(context: ExtensionContext) {
    const testController = tests.createTestController(
        "bruAsCodeTestController",
        getExtensionNameLabel(),
    );

    const logger = new OutputChannelLogger(
        window.createOutputChannel(getExtensionNameLabel(), { log: true }),
    );

    const fileChangedEmitter = Evt.create<FileChangedEvent>();
    const collectionWatcher = new CollectionWatcher(
        fileChangedEmitter,
        workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
        logger,
    );

    const multiFileOperationNotifier =
        new EventEmitter<MultiFileOperationWithStatus>();

    const testRunnerDataHelper = new TestRunnerDataHelper(testController);
    const collectionItemProvider =
        new CollectionItemProvider<AdditionalCollectionData>(
            collectionWatcher,
            getAdditionalCollectionDataCreator(testRunnerDataHelper),
            getPathsToIgnoreForCollections(),
            multiFileOperationNotifier.event,
            logger,
        );

    const startTestRunEmitter = new EventEmitter<{
        uri: Uri;
        withDialog: boolean;
    }>();

    context.subscriptions.push(
        client,
        startTestRunEmitter,
        multiFileOperationNotifier,
        collectionItemProvider,
        collectionWatcher,
        testRunnerDataHelper,
        logger,
        testController,
    );

    return {
        testController,
        logger,
        fileChangedEmitter,
        collectionWatcher,
        multiFileOperationNotifier,
        testRunnerDataHelper,
        collectionItemProvider,
        startTestRunEmitter,
    };
}

function getAdditionalCollectionDataCreator(
    testRunnerDataHelper: TestRunnerDataHelper,
) {
    return (item: CollectionItem) => ({
        treeItem: new BrunoTreeItem(
            item.getPath(),
            item.isFile(),
            isCollectionItemWithSequence(item) ? item.getSequence() : undefined,
            isRequestFile(item) ? item.getTags() : undefined,
        ),
        testItem: testRunnerDataHelper.createVsCodeTestItem(item),
    });
}

function getPathsToIgnoreForCollections() {
    return [
        new RegExp(
            `(/|\\\\)${getTemporaryJsFileBasenameWithoutExtension()}\\.js`,
        ),
    ];
}

function getExtensionNameLabel() {
    return "BruAsCode";
}
