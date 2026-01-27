import { KnownDiagnosticCode } from "../diagnosticCodes/knownDiagnosticCodeDefinition";

export class RelatedFilesDiagnosticsHelper {
    constructor() {
        this.diagnosticsForRelatedFiles = [];
    }

    private diagnosticsForRelatedFiles: RelatedFilesDiagnostic[];

    public dispose() {
        this.diagnosticsForRelatedFiles = [];
    }

    public registerDiagnostic(newDiagnostic: RelatedFilesDiagnostic) {
        for (const { files: knownFiles, diagnosticCode: knownCode } of this
            .diagnosticsForRelatedFiles) {
            if (
                newDiagnostic.files.some((file) => knownFiles.includes(file)) &&
                newDiagnostic.diagnosticCode == knownCode
            ) {
                knownFiles.push(
                    ...newDiagnostic.files.filter(
                        (newFile) => !knownFiles.includes(newFile)
                    )
                );
                return;
            }
        }

        this.diagnosticsForRelatedFiles.push(newDiagnostic);
    }

    public unregisterDiagnostic(
        file: string,
        diagnosticCode: KnownDiagnosticCode
    ) {
        const toAdjust = this.diagnosticsForRelatedFiles
            .map((val, index) => ({ diagnostic: val, index }))
            .filter(
                ({
                    diagnostic: {
                        files: registeredFiles,
                        diagnosticCode: registeredCode,
                    },
                }) =>
                    registeredFiles.includes(file) &&
                    registeredCode == diagnosticCode
            );

        if (toAdjust.length > 1) {
            throw new Error(
                `Found more than one entry for file '${file}' and diagnostic code '${diagnosticCode}' to unregister. Found entries: ${JSON.stringify(
                    toAdjust,
                    null,
                    2
                )}`
            );
        } else if (toAdjust.length == 0) {
            return;
        }

        const { diagnostic, index } = toAdjust[0];

        // For an entry with two files: if one file should be removed, only one would be left.
        // Therefore, there would not be multiple affected files anymore. So the whole entry can be removed in this case.
        if (diagnostic.files.length > 2) {
            diagnostic.files = diagnostic.files.filter(
                (registered) => registered != file
            );
        } else {
            this.diagnosticsForRelatedFiles.splice(index, 1);
        }
    }
}

interface RelatedFilesDiagnostic {
    files: string[];
    diagnosticCode: KnownDiagnosticCode;
}
