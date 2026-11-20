import {
    BrunoFileType,
    CollectionFormat,
    doesFileNameMatchFolderSettingsFileName,
    FileInfoType,
    getInfoTypeFromYamlContent,
    parseInfoFromYamlFile,
    TextDocumentHelper,
} from "../../..";

/**
 * Parses the info section of a yaml file that can have a sequence (request file, app file or folder settings file).
 * Folder settings files are determined by the file name, app files by the `info.type`.
 */
export function parseInfoFromYamlFileWithSequence(
    filePath: string,
    documentHelper: TextDocumentHelper,
) {
    return parseInfoFromYamlFile(
        documentHelper,
        doesFileNameMatchFolderSettingsFileName(filePath, CollectionFormat.Yaml)
            ? BrunoFileType.FolderSettingsFile
            : getInfoTypeFromYamlContent(documentHelper.getText()) ==
                FileInfoType.App
              ? BrunoFileType.AppFile
              : BrunoFileType.RequestFile,
    );
}
