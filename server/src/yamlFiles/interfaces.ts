import { Range, TextDocumentHelper } from "@global_shared";

export interface CommonDiagnosticParams {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}
