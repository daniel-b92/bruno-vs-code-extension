import { TextDocument, Position as VsCodePosition } from "vscode";
import { CodeBlockLanguageFeatureRequestWithAdditionalData } from "../interfaces";
import {
    Range,
    InbuiltFunctionIdentifier,
    InbuiltFunctionParsingParams,
    mapFromVsCodePosition,
} from "../../../../../shared";

export function mapToEnvVarNameParams(
    params: CodeBlockLanguageFeatureRequestWithAdditionalData,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
): InbuiltFunctionParsingParams {
    const {
        file: {
            blockContainingPosition: { content, contentRange },
        },
        request: { document, position },
    } = params;

    return {
        relevantContent: {
            asString: content,
            startPosition: contentRange.start,
            offsetInFullDocument: getDefaultOffsetForBlockContent(
                document,
                contentRange,
            ),
        },
        functionsToSearchFor,
        position: mapFromVsCodePosition(position),
    };
}

function getDefaultOffsetForBlockContent(
    document: TextDocument,
    blockContentRange: Range,
) {
    const firstContentLine = blockContentRange.start.line;

    return document.offsetAt(new VsCodePosition(firstContentLine, 0));
}
