import {
    Range,
    InbuiltFunctionIdentifier,
    InbuiltFunctionParsingParams,
    TextDocumentHelper,
    Position,
} from "@global_shared";
import { CodeBlockRequestWithAdditionalData } from "../../shared";

export function mapToEnvVarNameParams(
    params: CodeBlockRequestWithAdditionalData,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
): InbuiltFunctionParsingParams {
    const {
        file: {
            blockContainingPosition: { content, contentRange },
        },
        request: { documentHelper, position },
    } = params;

    return {
        relevantContent: {
            asString: content,
            startPosition: contentRange.start,
            offsetInFullDocument: getDefaultOffsetForBlockContent(
                documentHelper,
                contentRange,
            ),
        },
        functionsToSearchFor,
        position,
    };
}

function getDefaultOffsetForBlockContent(
    docHelper: TextDocumentHelper,
    blockContentRange: Range,
) {
    const firstContentLine = blockContentRange.start.line;

    return docHelper.getOffsetForPosition(new Position(firstContentLine, 0));
}
