import { TypedCollectionItemProvider } from "../../shared";
import { RelatedFilesDiagnosticsHelper } from "./shared/helpers/relatedFilesDiagnosticsHelper";
import { determineDiagnosticsForFolderSettingsFile } from "./folderSettingsFiles/determineDiagnosticsForFolderSettingsFile";
import { determineDiagnosticsForRequestFile } from "./requestFiles/determineDiagnosticsForRequestFile";
import { determineDiagnosticsForEnvironmentFile } from "./environmentFiles/determineDiagnosticsForEnvironmentFile";
import { determineDiagnosticsForCollectionSettingsFile } from "./collectionSettingsFiles/determineDiagnosticsForCollectionSettingsFile";

export class BrunoLangDiagnosticsProvider {
    constructor(private itemProvider: TypedCollectionItemProvider) {
        this.relatedRequestsHelper = new RelatedFilesDiagnosticsHelper();

        function handleDiagnosticUpdatesOnFileDeletionForBruFile(
            collectionItemProvider: TypedCollectionItemProvider,
            diagnosticCollection: DiagnosticCollection,
        ) {
            return collectionItemProvider.subscribeToUpdates((updates) => {
                for (const {
                    data: { item },
                    updateType,
                } of updates) {
                    if (
                        updateType == FileChangeType.Deleted &&
                        item.isFile() &&
                        extname(item.getPath()) == getExtensionForBrunoFiles()
                    ) {
                        diagnosticCollection.delete(Uri.file(item.getPath()));
                    } else if (
                        updateType == FileChangeType.Deleted &&
                        item instanceof CollectionDirectory
                    ) {
                        const normalizedDirPath = normalizeDirectoryPath(
                            item.getPath(),
                        );

                        diagnosticCollection.forEach((uri) => {
                            if (uri.fsPath.startsWith(normalizedDirPath)) {
                                diagnosticCollection.delete(uri);
                            }
                        });
                    }
                }
            });
        }
    }

    private relatedRequestsHelper: RelatedFilesDiagnosticsHelper;

    public dispose() {
        this.relatedRequestsHelper.dispose();
    }

    public async provideDiagnosticsForRequestFile(
        filePath: string,
        documentText: string,
    ) {
        return await determineDiagnosticsForRequestFile(
            filePath,
            documentText,
            this.itemProvider,
            this.relatedRequestsHelper,
        );
    }

    public provideDiagnosticsForEnvironmentFile(
        filePath: string,
        documentText: string,
    ) {
        return determineDiagnosticsForEnvironmentFile(filePath, documentText);
    }

    public provideDiagnosticsForCollectionSettingsFile(
        filePath: string,
        documentText: string,
    ) {
        return determineDiagnosticsForCollectionSettingsFile(
            filePath,
            documentText,
        );
    }

    public async provideDiagnosticsForFolderSettingsFile(
        filePath: string,
        documentText: string,
    ) {
        return await determineDiagnosticsForFolderSettingsFile(
            filePath,
            documentText,
            this.itemProvider,
            this.relatedRequestsHelper,
        );
    }
}
