import { TypedCollectionItemProvider } from "../../shared";
import { RelatedFilesDiagnosticsHelper } from "./shared/helpers/relatedFilesDiagnosticsHelper";
import { determineDiagnosticsForFolderSettingsFile } from "./folderSettingsFiles/determineDiagnosticsForFolderSettingsFile";
import { determineDiagnosticsForRequestFile } from "./requestFiles/determineDiagnosticsForRequestFile";
import { determineDiagnosticsForEnvironmentFile } from "./environmentFiles/determineDiagnosticsForEnvironmentFile";
import { determineDiagnosticsForCollectionSettingsFile } from "./collectionSettingsFiles/determineDiagnosticsForCollectionSettingsFile";
import { BrunoFileType } from "@global_shared";

export class BrunoLangDiagnosticsProvider {
    constructor(private itemProvider: TypedCollectionItemProvider) {
        this.relatedRequestsHelper = new RelatedFilesDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedFilesDiagnosticsHelper;

    public async getDiagnostics(
        filePath: string,
        content: string,
        brunoFileType: BrunoFileType,
    ) {
        switch (brunoFileType) {
            case BrunoFileType.RequestFile:
                return await determineDiagnosticsForRequestFile(
                    filePath,
                    content,
                    this.itemProvider,
                    this.relatedRequestsHelper,
                );
            case BrunoFileType.EnvironmentFile:
                return determineDiagnosticsForEnvironmentFile(
                    filePath,
                    content,
                );
            case BrunoFileType.FolderSettingsFile:
                return await determineDiagnosticsForFolderSettingsFile(
                    filePath,
                    content,
                    this.itemProvider,
                    this.relatedRequestsHelper,
                );
            case BrunoFileType.CollectionSettingsFile:
                return determineDiagnosticsForCollectionSettingsFile(
                    filePath,
                    content,
                );
            default:
                throw new Error(
                    `Fetching Bruno specific diagnostics not implemented for file type '${brunoFileType}'.`,
                );
        }
    }

    public dispose() {
        this.relatedRequestsHelper.dispose();
    }
}
