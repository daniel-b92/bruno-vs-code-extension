import { TextDocument, Position as VsCodePosition } from "vscode";
import { CodeBlockLanguageFeatureRequestWithAdditionalData } from "../interfaces";
import { Range } from "../../../../../shared";

export function mapToGetEnvVarNameParams(
    params: CodeBlockLanguageFeatureRequestWithAdditionalData,
) {
    const {
        file: {
            blockContainingPosition: { content, contentRange },
        },
        request: { document },
        logger,
    } = params;

    return {
        relevantContent: content.asPlainText,
        defaultOffsetWithinDocument: getDefaultOffsetForBlockContent(
            document,
            contentRange,
        ),
        request: params.request,
        logger,
    };
}

function getDefaultOffsetForBlockContent(
    document: TextDocument,
    blockContentRange: Range,
) {
    const firstContentLine = blockContentRange.start.line;

    return document.offsetAt(new VsCodePosition(firstContentLine, 0));
}
