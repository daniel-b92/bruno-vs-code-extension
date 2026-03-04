import { BrunoFileType, BrunoVariableReference } from "..";
import {
    CollectionItemWithBruVariables,
    CollectionItemWithSequence,
} from "./interfaces";

export class CollectionDirectory
    implements CollectionItemWithSequence, CollectionItemWithBruVariables
{
    constructor(
        private path: string,
        private sequence?: number,
        private variableReferences?: BrunoVariableReference[],
    ) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }

    public isFile() {
        return false;
    }

    public getItemType() {
        return BrunoFileType.FolderSettingsFile;
    }

    public getVariableReferences() {
        return this.variableReferences ?? [];
    }
}
