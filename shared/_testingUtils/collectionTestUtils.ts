import { Collection } from "../baseModel/collection";
import { CollectionFormat } from "../baseModel/interfaces";
import { getFileExtensionForFormat } from "../fileSystem/util/collectionFormatFileNames";
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
    format = CollectionFormat.Bru,
) {
    const collection = new Collection(
        new CollectionDirectory(rootDirectory),
        undefined,
        [],
        format,
    );

    for (const { name, extends: extendsName, variables } of environments) {
        collection.addItem({
            item: new BrunoEnvironmentFile(
                `${rootDirectory}/environments/${name}${getFileExtensionForFormat(format)}`,
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
