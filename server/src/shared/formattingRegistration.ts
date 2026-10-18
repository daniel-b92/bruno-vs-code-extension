import {
    Connection,
    Disposable,
    DocumentFormattingRequest,
    DocumentFilter,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";

/**
 * Formatting is registered dynamically instead of statically in the server capabilities.
 * That way, Yaml files only get this formatter assigned if they are part of a Yaml collection.
 * Otherwise, the formatter would compete with other Yaml formatters for all Yaml files in the workspace.
 */
export class FormattingRegistration implements Disposable {
    constructor(private connection: Connection) {}

    /** Needs to be called whenever the set of Yaml collections might have changed. */
    public update(yamlCollectionRootDirectories: string[]) {
        if (this.disposed) {
            return this.pendingUpdate;
        }

        const key = JSON.stringify([...yamlCollectionRootDirectories].sort());

        if (key == this.currentKey) {
            return this.pendingUpdate;
        }
        this.currentKey = key;

        const documentSelector: DocumentFilter[] = [
            { scheme: "file", language: "bru" },
            ...yamlCollectionRootDirectories.map((root): DocumentFilter => ({
                scheme: "file",
                language: "yaml",
                pattern: {
                    baseUri: URI.file(root).toString(),
                    pattern: "**/*.yml",
                },
            })),
        ];

        this.pendingUpdate = this.pendingUpdate
            .then(() => this.registration?.dispose())
            .then(() =>
                this.connection.client.register(
                    DocumentFormattingRequest.type,
                    {
                        documentSelector,
                    },
                ),
            )
            .then((registration) => {
                if (this.disposed) {
                    // The registration was requested before disposing, but only finished afterwards.
                    registration.dispose();
                } else {
                    this.registration = registration;
                }
            })
            .catch((error) => {
                this.registration = undefined;
                // Allows to retry the registration on the next update, even if the collections did not change.
                this.currentKey = undefined;
                this.connection.console.error(
                    `Failed to register the formatting provider: ${error}`,
                );
            });

        return this.pendingUpdate;
    }

    /** Unregisters synchronously, because the connection gets disposed right after this. */
    public dispose() {
        this.disposed = true;
        this.registration?.dispose();
        this.registration = undefined;
    }

    private disposed = false;
    private currentKey: string | undefined = undefined;
    private registration: Disposable | undefined = undefined;
    private pendingUpdate: Promise<void> = Promise.resolve();
}
