import { Range } from "../../fileSystem/range";
import { BrunoFileType, CollectionItem } from "../interfaces";

export class BrunoEnvironmentFile implements CollectionItem {
    constructor(
        private readonly path: string,
        private variables: {
            key: string;
            keyRange: Range;
            value: string;
            valueRange: Range;
        }[],
        private readonly extendsEnvironmentName?: string,
    ) {}

    public getPath() {
        return this.path;
    }

    public getVariables() {
        return this.variables?.slice();
    }

    public getExtends() {
        return this.extendsEnvironmentName;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.EnvironmentFile;
    }
}
