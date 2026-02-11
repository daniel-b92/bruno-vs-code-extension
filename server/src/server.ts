import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeResult,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getHandlerForFormatting } from "./bruFiles/formatting/getHandlerForFormatting";
import { HelpersProvider } from "./shared";
import { URI } from "vscode-uri";
import { runUpdatesOnWillSave } from "./bruFiles/autoUpdates/runUpdatesOnWillSave";

let helpersProvider: HelpersProvider;

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

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
        },
    };
    return result;
});

connection.onInitialized(async () => {
    const workspaceFolders = await getWorkspaceFolders();
    helpersProvider = new HelpersProvider(workspaceFolders);

    await helpersProvider.getItemProvider().refreshCache(workspaceFolders);
});

connection.onDocumentFormatting(({ textDocument: { uri } }) => {
    const document = documents.get(uri);
    return document ? getHandlerForFormatting(document) : undefined;
});

documents.onWillSaveWaitUntil(async ({ document: { uri } }) => {
    const document = documents.get(uri);
    return document
        ? runUpdatesOnWillSave(
              uri,
              document.getText(),
              helpersProvider.getItemProvider(),
          )
        : [];
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

async function getWorkspaceFolders() {
    return (
        (await connection.workspace.getWorkspaceFolders())?.map(
            ({ uri }) => URI.parse(uri).fsPath,
        ) ?? []
    );
}
