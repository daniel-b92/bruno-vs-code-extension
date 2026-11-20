import {
    BrunoFileType,
    excludeTrailingWhitespace,
    TextDocumentHelper,
    WithKeyAndValueRange,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../../../shared/interfaces";
import { getSequenceClashWithAppFilesDiagnostic } from "../../../../shared/diagnostics/relatedFiles/getSequenceClashWithAppFilesDiagnostic";

export function checkSequenceDoesNotClashWithAppFiles(data: {
    sequence: WithKeyAndValueRange<number> | undefined;
    docHelper: TextDocumentHelper;
    filePath: string;
    fileType: BrunoFileType.RequestFile | BrunoFileType.AppFile;
    itemProvider: TypedCollectionItemProvider;
}): Diagnostic | undefined {
    const { sequence, docHelper, ...rest } = data;

    return sequence
        ? getSequenceClashWithAppFilesDiagnostic({
              ...rest,
              sequence: sequence.value,
              sequenceRange: excludeTrailingWhitespace(
                  sequence.valueRange,
                  docHelper,
              ),
          })
        : undefined;
}
