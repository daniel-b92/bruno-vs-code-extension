import {
    BrunoVariableReference,
    BrunoVariableType,
    getPatternForVarsReadReferenceInNonCodeBlock,
    isDictionaryBlockSimpleField,
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
    contentRange: Range,
    parsedBlock: {
        content: ParsedBlockContent;
        contentRange: Range;
        name: string;
    },
): BrunoVariableReference[] {
    return getReadReferences(fullDocumentHelper, contentRange).concat(
        getWriteReferences(parsedBlock),
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

function getWriteReferences(parsedBlock: {
    content: ParsedBlockContent;
    name: string;
}): BrunoVariableReference[] {
    const { content: blockContent, name: blockName } = parsedBlock;

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
        variableType: BrunoVariableType.Simple,
        scope:
            blockName == RequestFileBlockName.PreRequestVars
                ? VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
                : VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
    }));
}
