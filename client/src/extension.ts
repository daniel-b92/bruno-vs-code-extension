import {
    commands,
    EventEmitter,
    ExtensionContext,
    ProgressLocation,
    tests,
    Uri,
    window,
    workspace,
} from "vscode";
import { activateRunner, TestRunnerDataHelper } from "./testRunner";
import { activateTreeView } from "./treeView";
import {
    OutputChannelLogger,
    MultiFileOperationWithStatus,
    AdditionalCollectionData,
    FileSystemCacheSyncingHelper,
    BrunoTreeItem,
    TypedCollectionItemProvider,
} from "@shared";
import { getFeatureToggles } from "./getFeatureToggles";
import {
    createYamlCollectionSearch,
    suggestEnablingYamlSupport,
    suggestReloadOnYamlSupportChange,
} from "./suggestEnablingYamlSupport";
import { activateLanguageFeatures } from "./languageFeatures";
import { suggestCreatingTsConfigsForCollections } from "./languageFeatures/suggestCreatingTsConfigsForCollections";
import { join } from "path";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
    TransportKind,
} from "vscode-languageclient/node";
import { Evt } from "evt";
import {
    CollectionWatcher,
    FileChangedEvent,
    CollectionItem,
    isCollectionItemWithTags,
    isRequestFileOrCollectionDirectory,
    CollectionItemProvider,
    getPathsToIgnoreForCollections,
    AdditionalCollectionSimpleDataProvider,
    AdditionalCollectionDataProviderType,
} from "@global_shared";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    suggestReloadOnYamlSupportChange(context);
    const doesWorkspaceContainYamlCollection = createYamlCollectionSearch();
    void suggestEnablingYamlSupport(
        context,
        doesWorkspaceContainYamlCollection,
    );

    if (
        await shouldSkipActivation(context, doesWorkspaceContainYamlCollection)
    ) {
        return;
    }

    client = createLanguagClient(context);

    const toAwait: Thenable<void>[] = [];
    // Start the client. This will also launch the server
    toAwait.push(client.start());

    const {
        collectionItemProvider,
        testController: ctrl,
        startTestRunEmitter,
        multiFileOperationNotifier,
        cacheSyncingHelper,
    } = createNeededHandlers(context);

    context.subscriptions.push(
        commands.registerCommand(
            "bruAsCode.restartLanguageServer",
            getCallbackForRestartingClient(),
        ),
    );

    // The collection cache is loaded lazily, as soon as something needs it.
    collectionItemProvider.subscribeToInitialCacheLoad(
        () =>
            void suggestCreatingTsConfigsForCollections(collectionItemProvider),
    );

    await activateRunner(
        context,
        ctrl,
        collectionItemProvider,
        startTestRunEmitter.event,
    );
    activateTreeView(
        context,
        collectionItemProvider,
        cacheSyncingHelper,
        startTestRunEmitter,
        multiFileOperationNotifier,
    );

    toAwait.push(
        activateLanguageFeatures(
            context,
            collectionItemProvider,
            getFeatureToggles(context),
        ),
    );

    await Promise.all(toAwait);

    // Nothing else reacts to editors that were restored on startup.
    if (hasVisibleEditorForRelevantFile(collectionItemProvider)) {
        void collectionItemProvider.ensureCacheIsLoaded();
    }
}

function hasVisibleEditorForRelevantFile(
    collectionItemProvider: TypedCollectionItemProvider,
) {
    return window.visibleTextEditors.some(
        ({ document: { uri, fileName } }) =>
            uri.scheme == "file" &&
            collectionItemProvider.isFileRelevantForCollections(fileName),
    );
}

// The activation event for `opencollection.yml` files is static, so it also triggers the activation when Yaml support is disabled.
// In that case, the activation is skipped if it could only have been triggered by Yaml collections.
// The extension can also be activated for single Bru files that are not part of the workspace (e.g. if no folder is opened).
async function shouldSkipActivation(
    context: ExtensionContext,
    doesWorkspaceContainYamlCollection: () => PromiseLike<boolean>,
) {
    if (
        getFeatureToggles(context).yamlCollectionSupport ||
        workspace.textDocuments.some(({ languageId }) => languageId == "bru")
    ) {
        return false;
    }

    // Bru files only need to be searched for if a Yaml collection exists, so that usually only one search is needed.
    return (
        (await doesWorkspaceContainYamlCollection()) &&
        (await workspace.findFiles("**/*.bru", undefined, 1)).length == 0
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

    const featureToggles = getFeatureToggles(context);

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "bru" },
            { scheme: "file", language: "javascript" },
            ...(featureToggles.yamlCollectionSupport
                ? [{ scheme: "file", language: "yaml", pattern: "**/*.yml" }]
                : []),
        ],
        initializationOptions: { featureToggles },
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

    const cacheRefreshNotifier = Evt.create<void>();
    const cacheRefreshNotifierContext = Evt.newCtx();
    cacheRefreshNotifier.attach(
        cacheRefreshNotifierContext,
        // Whenever a full cache refresh is triggered, also restart the server to refresh the server-side cache, too.
        () =>
            client.state == State.Running
                ? getCallbackForRestartingClient()()
                : logger.debug(
                      `Skipping restart of language client on cache refresh, since it does not have status 'Running'.`,
                  ),
    );
    const collectionItemProvider =
        new CollectionItemProvider<AdditionalCollectionData>(
            collectionWatcher,
            workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ??
                [],
            getAdditionalCollectionDataProvider(testRunnerDataHelper),
            getPathsToIgnoreForCollections(),
            getFeatureToggles(context),
            cacheRefreshNotifier,
            logger,
            (conflicts) =>
                window.showWarningMessage(
                    `Ignoring ${conflicts.length} Bruno collection root file(s), because other collection root files exist in the same directory or its subdirectories: ${conflicts
                        .map(
                            ({ rootFilePath, conflictingFilePaths }) =>
                                `'${rootFilePath}' (conflicts with ${conflictingFilePaths.map((path) => `'${path}'`).join(", ")})`,
                        )
                        .join("; ")}`,
                ),
            async (load) =>
                await window.withProgress(
                    {
                        location: ProgressLocation.Window,
                        title: "Loading Bruno collections...",
                    },
                    load,
                ),
        );

    const cacheSyncingHelper = new FileSystemCacheSyncingHelper(
        collectionItemProvider,
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
        cacheSyncingHelper,
        { dispose: () => cacheRefreshNotifierContext.done() },
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
        cacheSyncingHelper,
        cacheRefreshNotifier,
    };
}

function getAdditionalCollectionDataProvider(
    testRunnerDataHelper: TestRunnerDataHelper,
): AdditionalCollectionSimpleDataProvider<AdditionalCollectionData> {
    return {
        paramType: AdditionalCollectionDataProviderType.SimpleCollectionItem,
        callback: (item: CollectionItem, isCollectionRoot: boolean) => ({
            treeItem: new BrunoTreeItem(
                item.getPath(),
                item.isFile(),
                isCollectionRoot,
                isRequestFileOrCollectionDirectory(item)
                    ? item.getSequence()
                    : undefined,
                isCollectionItemWithTags(item) ? item.getTags() : undefined,
            ),
            testItem: testRunnerDataHelper.createVsCodeTestItem(item),
        }),
        isAdditionalDataOutdated(
            { treeItem: oldTreeItem },
            { treeItem: newTreeItem },
        ) {
            return (
                oldTreeItem.description != newTreeItem.description ||
                oldTreeItem.tooltip != newTreeItem.tooltip
            );
        },
    };
}

function getCallbackForRestartingClient() {
    return () => {
        if (client) {
            client.restart();
        }
    };
}

function getExtensionNameLabel() {
    return "BruAsCode";
}
