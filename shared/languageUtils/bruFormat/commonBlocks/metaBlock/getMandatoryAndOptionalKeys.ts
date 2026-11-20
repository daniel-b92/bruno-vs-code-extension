import { BrunoFileType, MetaBlockKey } from "../../../..";

export function getMetaBlockMandatoryKeys(fileType: BrunoFileType) {
    return [BrunoFileType.RequestFile, BrunoFileType.AppFile].includes(fileType)
        ? [MetaBlockKey.Name, MetaBlockKey.Sequence, MetaBlockKey.Type]
        : fileType == BrunoFileType.FolderSettingsFile
          ? [MetaBlockKey.Name, MetaBlockKey.Sequence]
          : undefined;
}

export function getMetaBlockOptionalKeys(fileType: BrunoFileType) {
    return fileType == BrunoFileType.RequestFile ||
        fileType == BrunoFileType.FolderSettingsFile
        ? [MetaBlockKey.Tags]
        : undefined;
}
