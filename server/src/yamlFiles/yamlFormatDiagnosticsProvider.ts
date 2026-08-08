import {
    BrunoFileType,
    parseYamlEnvironmentFile,
    TextDocumentHelper,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";

export class YamlFormatDiagnosticsProvider {
    constructor() {}

    public getDiagnosticsForYamlFile(
        filePath: string,
        content: string,
        brunoFileType: BrunoFileType,
    ) {
        switch (brunoFileType) {
            case BrunoFileType.EnvironmentFile:
                return this.getDiagnosticsForEnvironmentFile(filePath, content);
            default:
                return [];
        }
    }

    public getDiagnosticsForEnvironmentFile(
        _filePath: string,
        content: string,
    ): Diagnostic[] {
        const parsed = parseYamlEnvironmentFile(
            new TextDocumentHelper(content),
        );
        const errors = Array.isArray(parsed) ? parsed : parsed.errors;
        return errors.map((err) => ({ ...err, code: undefined }));
    }

    public dispose() {}
}
