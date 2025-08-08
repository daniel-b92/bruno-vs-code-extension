import { BrunoFileType, FileType } from "../..";

export function isBrunoFileType(fileType: FileType): fileType is BrunoFileType {
    return (
        fileType != "other" && Object.values(BrunoFileType).includes(fileType)
    );
}
