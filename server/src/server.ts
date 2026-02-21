import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeResult,
    TextDocumentPositionParams,
    CancellationToken,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getHandlerForFormatting } from "./bruFiles/formatting/getHandlerForFormatting";
import {
    getDefaultLogger,
    HelpersProvider,
    LanguageFeatureBaseRequest,
    TypedCollectionItemProvider,
} from "./shared";
import { URI } from "vscode-uri";
import { runUpdatesOnWillSave } from "./bruFiles/autoUpdates/runUpdatesOnWillSave";
import {
    getEnvironmentSettingsKey,
    getItemType,
    isBrunoFileType,
    Position,
    TextDocumentHelper,
} from "@global_shared";
import { handleCompletionRequest } from "./bruFiles/completions/handleCompletionRequest";
import { Disposable } from "vscode-languageserver/node";
import { BrunoLangDiagnosticsProvider } from "./bruFiles/diagnostics/brunoLangDiagnosticsProvider";
import { handleHoverRequest } from "./bruFiles/hover/handleHoverRequest";

let helpersProvider: HelpersProvider;
let brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider;
const disposables: Disposable[] = [];

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

disposables.push(
    connection.onInitialize(async () => {
        const result: InitializeResult = {
            capabilities: {
                workspace: { workspaceFolders: { supported: true } },
                textDocumentSync: {
                    change: TextDocumentSyncKind.Full,
                    willSaveWaitUntil: true,
                    willSave: true,
                    openClose: true,
                    save: true,
                },
                documentFormattingProvider: true,
                completionProvider: {
                    triggerCharacters: [":", " ", "{", ".", "/", '"', "'", "`"],
                    completionItem: { labelDetailsSupport: true },
                },
                diagnosticProvider: {
                    interFileDependencies: true,
                    workspaceDiagnostics: false,
                },
                hoverProvider: true,
            },
        };
        return result;
    }),
);

disposables.push(
    connection.onInitialized(async () => {
        const workspaceFolders = await getWorkspaceFolders();
        helpersProvider = new HelpersProvider(workspaceFolders);
        disposables.push(helpersProvider);

        const itemProvider = helpersProvider.getItemProvider();

        await itemProvider.refreshCache(workspaceFolders);
        brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
            itemProvider,
        );

        disposables.push(brunoLangDiagnosticsProvider);

        itemProvider.subscribeToUpdates((changes) => {
            if (
                changes.some(
                    ({ changedData }) =>
                        changedData && changedData.sequenceChanged,
                )
            ) {
                // Needed for keeping diagnostics for duplicate sequences in sync.
                connection.languages.diagnostics.refresh();
            }
        });
    }),
);

disposables.push(
    connection.onDocumentFormatting(({ textDocument: { uri } }) => {
        const document = documents.get(uri);
        return document ? getHandlerForFormatting(document) : undefined;
    }),
);

disposables.push(
    connection.onCompletion(async (params, token) => {
        const request = mapToBaseLanguageRequest(params, token);

        return request && helpersProvider
            ? handleCompletionRequest(
                  request,
                  helpersProvider.getItemProvider(),
                  await getConfiguredTestEnvironment(),
                  getDefaultLogger(),
              )
            : undefined;
    }),
);

disposables.push(
    connection.languages.diagnostics.on(async ({ textDocument: { uri } }) => {
        const document = documents.get(uri);

        const items = document
            ? ((await getDiagnosticsForBruFile(
                  URI.parse(uri).fsPath,
                  document.getText(),
              )) ?? [])
            : [];

        return {
            kind: "full",
            items,
        };
    }),
);

connection.onHover(async (params, token) => {
    const baseRequest = mapToBaseLanguageRequest(params, token);

    return baseRequest && helpersProvider
        ? handleHoverRequest(
              baseRequest,
              helpersProvider.getItemProvider(),
              await getConfiguredTestEnvironment(),
              getDefaultLogger(),
          )
        : undefined;
});

documents.onWillSaveWaitUntil(async ({ document: { uri } }) => {
    const document = documents.get(uri);
    return document && helpersProvider
        ? runUpdatesOnWillSave(
              uri,
              document.getText(),
              helpersProvider.getItemProvider(),
          )
        : [];
});

connection.onExit(() => {
    dispose();
});

connection.onShutdown(() => {
    dispose();
});

// Make the text document manager listen on the connection
// for open, change and close text document events
disposables.push(documents.listen(connection));

// Listen on the connection
connection.listen();

async function getWorkspaceFolders() {
    return (
        (await connection.workspace.getWorkspaceFolders())?.map(
            ({ uri }) => URI.parse(uri).fsPath,
        ) ?? []
    );
}

function dispose() {
    disposables.forEach((d) => d.dispose());
    connection.dispose();
}

function mapToBaseLanguageRequest(
    {
        textDocument: { uri },
        position: { line, character },
    }: TextDocumentPositionParams,
    token: CancellationToken,
): LanguageFeatureBaseRequest | undefined {
    const document = documents.get(uri);

    return document
        ? {
              filePath: URI.parse(uri).fsPath,
              documentHelper: new TextDocumentHelper(document.getText()),
              position: new Position(line, character),
              token,
          }
        : undefined;
}

async function getConfiguredTestEnvironment() {
    return (await connection.workspace.getConfiguration(
        getEnvironmentSettingsKey(),
    )) as string | undefined;
}

async function getDiagnosticsForBruFile(filePath: string, text: string) {
    const brunoFileType = helpersProvider
        ? await getBrunoFileTypeIfExists(
              helpersProvider.getItemProvider(),
              filePath,
          )
        : undefined;

    if (!brunoLangDiagnosticsProvider || !brunoFileType) {
        return undefined;
    }

    return await brunoLangDiagnosticsProvider.getDiagnostics(
        filePath,
        text,
        brunoFileType,
    );
}

async function getBrunoFileTypeIfExists(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (!collection) {
        return undefined;
    }

    const itemType = await getItemType(collection, filePath);
    return itemType && isBrunoFileType(itemType) ? itemType : undefined;
}
