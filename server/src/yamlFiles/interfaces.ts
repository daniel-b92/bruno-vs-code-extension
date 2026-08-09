import { Range, TextDocumentHelper } from "@global_shared";

export interface CommonDiagnosticParams {
    filePath: string;
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}
