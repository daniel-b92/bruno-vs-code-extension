import { TextDocument, Position as VsCodePosition } from "vscode";
import { CodeBlockLanguageFeatureRequestWithAdditionalData } from "../interfaces";
import { Range, InbuiltFunctionIdentifier } from "../../../../../shared";

export function mapToEnvVarNameParams(
    params: CodeBlockLanguageFeatureRequestWithAdditionalData,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
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
        functionsToSearchFor,
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
