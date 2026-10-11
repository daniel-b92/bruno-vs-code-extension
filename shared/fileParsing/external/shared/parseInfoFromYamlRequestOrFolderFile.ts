import {
    BrunoFileType,
    CollectionFormat,
    doesFileNameMatchFolderSettingsFileName,
    parseInfoFromYamlFile,
    TextDocumentHelper,
} from "../../..";

/** Parses the info section of a yaml request file or folder settings file. Which of both it is, is determined by the file name. */
export function parseInfoFromYamlRequestOrFolderFile(
    filePath: string,
    documentHelper: TextDocumentHelper,
) {
    return parseInfoFromYamlFile(
        documentHelper,
        doesFileNameMatchFolderSettingsFileName(filePath, CollectionFormat.Yaml)
            ? BrunoFileType.FolderSettingsFile
            : BrunoFileType.RequestFile,
    );
}
