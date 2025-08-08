import {
    EventEmitter,
    ExtensionContext,
    ProgressLocation,
    tests,
    Uri,
    window,
} from "vscode";
import { activateRunner } from "./testRunner";
import { activateTreeView } from "./explorer";
import {
    CollectionWatcher,
    FileChangedEvent,
    CollectionItemProvider,
    TestRunnerDataHelper,
    getTemporaryJsFileName,
    OutputChannelLogger,
    suggestCreatingTsConfigsForCollections,
    getExtensionForBrunoFiles,
} from "../../shared";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";
import { join } from "path";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    const extensionNameLabel = "BruAsCode";

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        join("server", "out", "server.js"),
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
        documentSelector: [
            { scheme: "file", pattern: `**/*${getExtensionForBrunoFiles()}` },
        ],
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        "bru-as-code",
        "Bru As Code",
        serverOptions,
        clientOptions,
    );

    const ctrl = tests.createTestController(
        "bruAsCodeTestController",
        extensionNameLabel,
    );

    const logger = new OutputChannelLogger(
        window.createOutputChannel(extensionNameLabel, { log: true }),
    );

    const fileChangedEmitter = new EventEmitter<FileChangedEvent>();
    const collectionWatcher = new CollectionWatcher(fileChangedEmitter, logger);

    const collectionItemProvider = new CollectionItemProvider(
        collectionWatcher,
        new TestRunnerDataHelper(ctrl),
        getPathsToIgnoreForCollection,
        logger,
    );

    const startTestRunEmitter = new EventEmitter<Uri>();

    context.subscriptions.push(
        ctrl,
        client,
        logger,
        fileChangedEmitter,
        collectionWatcher,
        collectionItemProvider,
        startTestRunEmitter,
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

    // Start the client. This will also launch the server
    return client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

function getPathsToIgnoreForCollection(collectionRootDirectory: string) {
    return [getTemporaryJsFileName(collectionRootDirectory)];
}
