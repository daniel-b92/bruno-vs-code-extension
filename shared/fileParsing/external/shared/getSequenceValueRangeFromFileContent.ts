import { extname } from "path";
import {
    BrunoFileType,
    CollectionFormat,
    doesFileNameMatchFolderSettingsFileName,
    getExtensionForBrunoFiles,
    getFileExtensionForFormat,
    getSequenceFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
    parseInfoFromYamlFile,
    Position,
    Range,
    TextDocumentHelper,
} from "../../..";

/**
 * Determines the range of the sequence value inside the content of a request file or a folder settings file.
 * The file format is determined by the extension of the given file path.
 *
 * Returns `undefined`, if the format cannot be determined or the file does not contain a valid sequence.
 */
export function getSequenceValueRangeFromFileContent(
    filePath: string,
    content: string,
): Range | undefined {
    const documentHelper = new TextDocumentHelper(content);
    const extension = extname(filePath);

    if (extension == getExtensionForBrunoFiles()) {
        const sequenceField = getSequenceFieldFromMetaBlock(documentHelper);

        return sequenceField && isDictionaryBlockSimpleField(sequenceField)
            ? sequenceField.valueRange
            : undefined;
    }

    if (extension == getFileExtensionForFormat(CollectionFormat.Yaml)) {
        const parsed = parseInfoFromYamlFile(
            documentHelper,
            doesFileNameMatchFolderSettingsFileName(
                filePath,
                CollectionFormat.Yaml,
            )
                ? BrunoFileType.FolderSettingsFile
                : BrunoFileType.RequestFile,
        );

        const valueRange =
            "result" in parsed
                ? parsed.result?.properties.sequence?.valueRange
                : undefined;

        return valueRange
            ? excludeTrailingWhitespace(valueRange, documentHelper)
            : undefined;
    }

    return undefined;
}

/** For yaml scalars followed by a comment, the parsed range can include the whitespace in front of the comment. */
export function excludeTrailingWhitespace(
    range: Range,
    documentHelper: TextDocumentHelper,
) {
    const line = documentHelper.getLineByIndex(range.end.line);
    let endCharacter = range.end.character;

    while (endCharacter > 0 && /\s/.test(line.charAt(endCharacter - 1))) {
        endCharacter--;
    }

    return new Range(
        range.start,
        new Position(range.end.line, Math.max(endCharacter, 0)),
    );
}
