import { Collection } from "../baseModel/collection";
import { CollectionDirectory } from "../baseModel/collectionDirectory";
import { BrunoEnvironmentFile } from "../baseModel/files/brunoEnvironmentFile";

export function createCollectionWithEnvironments(
    environments: { name: string; extends?: string }[],
    rootDirectory = "/collection",
) {
    const collection = new Collection(
        new CollectionDirectory(rootDirectory),
        undefined,
        [],
    );

    for (const { name, extends: extendsName } of environments) {
        collection.addItem({
            item: new BrunoEnvironmentFile(
                `${rootDirectory}/environments/${name}.bru`,
                [],
                extendsName,
            ),
            additionalData: undefined,
        });
    }

    return collection;
}
