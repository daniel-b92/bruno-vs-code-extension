import { TextDocument, Position as VsCodePosition } from "vscode";
import { BruLanguageFeatureRequestWithAdditionalData } from "../interfaces";
import { Range } from "../../../../../shared";
import { parseEnvVariableNameFromTsSourceFile } from "../../../shared/environmentVariables/parseEnvVariableNameFromTsSourceFile";

export function getStringLiteralParameterForGetEnvVarInbuiltFunction(
    params: BruLanguageFeatureRequestWithAdditionalData,
) {
    const {
        file: {
            blockContainingPosition: { content, contentRange },
        },
        request: { document },
        logger,
    } = params;

    return parseEnvVariableNameFromTsSourceFile(
        {
            relevantContent: content as string,
            defaultOffsetWithinDocument: getDefaultOffsetForBlockContent(
                document,
                contentRange,
            ),
        },
        params.request,
        logger,
    );
}

function getDefaultOffsetForBlockContent(
    document: TextDocument,
    blockContentRange: Range,
) {
    const firstContentLine = blockContentRange.start.line;

    return document.offsetAt(new VsCodePosition(firstContentLine, 0));
}
