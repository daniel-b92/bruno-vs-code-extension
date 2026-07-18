import {
    BrunoFileType,
    BrunoVariableReference,
    BrunoVariableType,
    getPatternForVarsReadReferenceInNonCodeBlock,
    isDictionaryBlockSimpleField,
    ItemType,
    Position,
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
    VariableAvailabilityScopes,
    VariableReferenceType,
} from "../../..";
import { ParsedBlockContent } from "../getBlockContent";

export function getBrunoVariableReferencesInNonCodeBlock(
    fullDocumentHelper: TextDocumentHelper,
    dataForSearchingVariableReferences: {
        itemType: ItemType;
    },
    parsedBlock: {
        content: ParsedBlockContent;
        contentRange: Range;
        name: string;
    },
): BrunoVariableReference[] {
    return getReadReferences(
        fullDocumentHelper,
        parsedBlock.contentRange,
    ).concat(
        getWriteReferences(parsedBlock, dataForSearchingVariableReferences),
    );
}

function getReadReferences(
    fullDocumentHelper: TextDocumentHelper,
    contentRange: Range,
) {
    const matches = Array.from(
        fullDocumentHelper
            .getText(contentRange)
            .matchAll(
                new RegExp(getPatternForVarsReadReferenceInNonCodeBlock(), "g"),
            ),
    );

    if (matches.length == 0) {
        return [];
    }

    return matches
        .map((match) => {
            const matchingText = match[0];
            const variableStartOffsetWithinMatch = 2;
            const variableName = matchingText.substring(
                matchingText.indexOf("{{") + variableStartOffsetWithinMatch,
                matchingText.indexOf("}}"),
            );
            const variableStartPositionInFullDocument =
                fullDocumentHelper.getPositionForOffset(
                    contentRange.start,
                    match.index + variableStartOffsetWithinMatch,
                );

            return variableStartPositionInFullDocument
                ? {
                      variableName,
                      variableNameRange: new Range(
                          variableStartPositionInFullDocument,
                          new Position(
                              variableStartPositionInFullDocument.line,
                              variableStartPositionInFullDocument.character +
                                  variableName.length,
                          ),
                      ),
                      referenceType: VariableReferenceType.Read, // In non-code blocks, variables can not be set.
                      variableType: BrunoVariableType.Unknown, // In non-code blocks, variables can only be accessed by name, not by any specific type.
                  }
                : undefined;
        })
        .filter((v) => v != undefined);
}

function getWriteReferences(
    parsedBlock: {
        content: ParsedBlockContent;
        name: string;
    },
    dataForSearchingVariableReferences: {
        itemType: ItemType;
    },
): BrunoVariableReference[] {
    const { content: blockContent, name: blockName } = parsedBlock;
    const { itemType } = dataForSearchingVariableReferences;

    if (
        !(
            [
                RequestFileBlockName.PreRequestVars,
                RequestFileBlockName.PostResponseVars,
            ] as string[]
        ).includes(blockName) ||
        !Array.isArray(blockContent)
    ) {
        return [];
    }

    const activeFields = blockContent
        .filter((field) => isDictionaryBlockSimpleField(field))
        .filter(({ disabled }) => !disabled);

    return activeFields.map(({ key, keyRange }) => ({
        referenceType: VariableReferenceType.Write,
        variableName: key,
        variableNameRange: keyRange,
        variableType:
            itemType == BrunoFileType.RequestFile
                ? BrunoVariableType.Request
                : BrunoVariableType.Folder,
        scope:
            blockName == RequestFileBlockName.PreRequestVars
                ? VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
                : VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
    }));
}
