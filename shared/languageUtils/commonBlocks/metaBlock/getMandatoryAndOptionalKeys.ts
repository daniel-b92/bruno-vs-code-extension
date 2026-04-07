import { BrunoFileType, MetaBlockKey } from "../../..";

export function getMetaBlockMandatoryKeys(fileType: BrunoFileType) {
    return fileType == BrunoFileType.RequestFile
        ? [MetaBlockKey.Name, MetaBlockKey.Sequence, MetaBlockKey.Type]
        : fileType == BrunoFileType.FolderSettingsFile
          ? [MetaBlockKey.Name, MetaBlockKey.Sequence]
          : undefined;
}

export function getMetaBlockOptionalKeys(fileType: BrunoFileType) {
    return fileType == BrunoFileType.RequestFile
        ? [MetaBlockKey.Tags]
        : undefined;
}
