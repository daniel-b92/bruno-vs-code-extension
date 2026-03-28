import {
    Range,
    InbuiltFunctionIdentifier,
    InbuiltFunctionParsingParams,
    TextDocumentHelper,
    Position,
    CodeBlock,
} from "@global_shared";
import { BlockRequestWithAdditionalData } from "./interfaces";

export function mapToVariableNameParams(
    fullRequest: BlockRequestWithAdditionalData<CodeBlock>,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
): InbuiltFunctionParsingParams {
    const {
        file: {
            blockContainingPosition: { content, contentRange },
        },
        request: { documentHelper, position },
    } = fullRequest;

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
