import { Document } from "yaml";
import {
    BrunoFileType,
    Position,
    Range,
    TextDocumentHelper,
    YamlExpectedKeyInfo,
} from "../../..";
import { getDescriptorsForText } from "./getDescriptorsForText";

/**
 * Finds the key at the given position and returns the information about what the parser expects for it.
 *
 * @returns `undefined`, if the position is not within a key or the key is not expected at its place (e.g. an unknown key).
 */
export function getYamlKeyInfoAtPosition({
    docHelper,
    fileType,
    position,
    parsedDocument,
}: {
    docHelper: TextDocumentHelper;
    fileType: BrunoFileType;
    position: Position;
    /** If defined, it is used instead of parsing the text again. It needs to be the parsed text of the given document helper. */
    parsedDocument?: Document;
}): { keyInfo: YamlExpectedKeyInfo; keyRange: Range } | undefined {
    for (const { definedKeys, expectedKeys } of getDescriptorsForText(
        docHelper.getText(),
        fileType,
        parsedDocument,
    )) {
        const defined = definedKeys.find(({ keyRange }) =>
            keyRange.contains(position),
        );
        const keyInfo = defined
            ? expectedKeys.find(({ key }) => key == defined.key)
            : undefined;

        if (defined && keyInfo) {
            return { keyInfo, keyRange: defined.keyRange };
        }
    }

    return undefined;
}
