import { Collection } from "../baseModel/collection";
import { CollectionDirectory } from "../baseModel/collectionDirectory";
import { BrunoEnvironmentFile } from "../baseModel/files/brunoEnvironmentFile";
import { getDummyRange } from "./documentTestUtils";

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
