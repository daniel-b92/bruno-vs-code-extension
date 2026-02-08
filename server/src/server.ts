import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeResult,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getHandlerForFormatting } from "./bruFiles/formatting/getHandlerForFormatting";
import { HelperProvider } from "./shared";

let helperProvider: HelperProvider;

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize(async () => {
    const result: InitializeResult = {
        capabilities: {
            workspace: { workspaceFolders: { supported: true } },
            textDocumentSync: TextDocumentSyncKind.Full,
            documentFormattingProvider: true,
        },
    };
    return result;
});

connection.onInitialized(async () => {
    const workspaceFolders = await getWorkspaceFolders();
    helperProvider = new HelperProvider(workspaceFolders);

    connection.console.info("Starting to refresh cache...");
    await helperProvider.getItemProvider().refreshCache(workspaceFolders);

    connection.console.info("Done refreshing cache.");
});

connection.onDocumentFormatting(({ textDocument: { uri } }) => {
    const document = documents.get(uri);
    return document ? getHandlerForFormatting(document) : undefined;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

async function getWorkspaceFolders() {
    return (
        (await connection.workspace.getWorkspaceFolders())?.map(
            (f) => f.name,
        ) ?? []
    );
}
