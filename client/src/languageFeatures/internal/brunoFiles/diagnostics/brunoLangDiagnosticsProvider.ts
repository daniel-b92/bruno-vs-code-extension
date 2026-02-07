import { DiagnosticCollection, Uri } from "vscode";
import { TypedCollectionItemProvider } from "../../../../shared";
import { RelatedFilesDiagnosticsHelper } from "./shared/helpers/relatedFilesDiagnosticsHelper";
import { determineDiagnosticsForFolderSettingsFile } from "./folderSettingsFiles/determineDiagnosticsForFolderSettingsFile";
import { determineDiagnosticsForRequestFile } from "./requestFiles/determineDiagnosticsForRequestFile";
import { determineDiagnosticsForEnvironmentFile } from "./environmentFiles/determineDiagnosticsForEnvironmentFile";
import { determineDiagnosticsForCollectionSettingsFile } from "./collectionSettingsFiles/determineDiagnosticsForCollectionSettingsFile";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: TypedCollectionItemProvider,
    ) {
        this.relatedRequestsHelper = new RelatedFilesDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedFilesDiagnosticsHelper;

    public dispose() {
        this.diagnosticCollection.clear();
        this.relatedRequestsHelper.dispose();
    }

    public async provideDiagnosticsForRequestFile(
        documentUri: Uri,
        documentText: string,
    ) {
        const newDiagnostics = await determineDiagnosticsForRequestFile(
            documentUri,
            documentText,
            this.itemProvider,
            this.relatedRequestsHelper,
        );

        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    public provideDiagnosticsForEnvironmentFile(
        documentUri: Uri,
        documentText: string,
    ) {
        const newDiagnostics = determineDiagnosticsForEnvironmentFile(
            documentUri,
            documentText,
        );

        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    public provideDiagnosticsForCollectionSettingsFile(
        documentUri: Uri,
        documentText: string,
    ) {
        const newDiagnostics = determineDiagnosticsForCollectionSettingsFile(
            documentUri,
            documentText,
        );

        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    public async provideDiagnosticsForFolderSettingsFile(
        documentUri: Uri,
        documentText: string,
    ) {
        const newDiagnostics = await determineDiagnosticsForFolderSettingsFile(
            documentUri,
            documentText,
            this.itemProvider,
            this.relatedRequestsHelper,
        );

        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }
}
