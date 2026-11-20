import { Document } from "yaml";
import {
    BrunoFileType,
    TextDocumentHelper,
    YamlMapDescriptor,
    YamlParsingOptions,
} from "../../..";
import { parseRequestFile } from "./parseRequestFile";
import { parseFolderSettingsFile } from "./parseFolderSettingsFile";
import { parseCollectionSettingsFile } from "./parseCollectionSettingsFile";
import { parseYamlEnvironmentFile } from "./parseYamlEnvironmentFile";
import { parseAppFile } from "./parseAppFile";

export function getDescriptorsForText(
    text: string,
    fileType: BrunoFileType,
    /** If defined, it is used instead of parsing the text again. It needs to be the parsed text. */
    parsedDocument?: Document,
) {
    const mapDescriptors: YamlMapDescriptor[] = [];
    const options: YamlParsingOptions = {
        mapDescriptors,
        continueOnSyntaxErrors: true,
        parsedDocument,
    };
    const docHelper = new TextDocumentHelper(text);

    switch (fileType) {
        case BrunoFileType.RequestFile:
            parseRequestFile(docHelper, options);
            break;
        case BrunoFileType.FolderSettingsFile:
            parseFolderSettingsFile(docHelper, options);
            break;
        case BrunoFileType.CollectionSettingsFile:
            parseCollectionSettingsFile(docHelper, options);
            break;
        case BrunoFileType.EnvironmentFile:
            parseYamlEnvironmentFile(docHelper, options);
            break;
        case BrunoFileType.AppFile:
            parseAppFile(docHelper, options);
            break;
    }

    return mapDescriptors;
}
