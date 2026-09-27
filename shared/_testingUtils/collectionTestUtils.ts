import { Collection } from "../baseModel/collection";
import { CollectionDirectory } from "../baseModel/collectionDirectory";
import { BrunoEnvironmentFile } from "../baseModel/files/brunoEnvironmentFile";
import { Position } from "../fileSystem/position";
import { Range } from "../fileSystem/range";

export function createCollectionWithEnvironments(
    environments: {
        name: string;
        extends?: string;
        variables?: { key: string; value: string }[];
    }[],
    rootDirectory = "/collection",
) {
    const collection = new Collection(
        new CollectionDirectory(rootDirectory),
        undefined,
        [],
    );

    for (const { name, extends: extendsName, variables } of environments) {
        collection.addItem({
            item: new BrunoEnvironmentFile(
                `${rootDirectory}/environments/${name}.bru`,
                (variables ?? []).map(({ key, value }) => ({
                    key,
                    value,
                    keyRange: getDummyRange(),
                    valueRange: getDummyRange(),
                })),
                extendsName,
            ),
            additionalData: undefined,
        });
    }

    return collection;
}

function getDummyRange() {
    return new Range(new Position(0, 0), new Position(0, 0));
}
