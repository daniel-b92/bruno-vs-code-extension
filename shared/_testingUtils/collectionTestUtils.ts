import { Collection } from "../baseModel/collection";
import { CollectionFormat, CollectionItem } from "../baseModel/interfaces";
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
    format: CollectionFormat,
    rootDirectory = "/collection",
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

/**
 * Creates a stub of an item provider, that resolves every path to the same collection (which is also the only registered one).
 * Without a given collection, an empty one is used.
 * The provider type is specific to each package, so it has to be passed as type argument.
 */
export function createItemProviderStub<TProvider>(
    rootDirectory: string,
    format: CollectionFormat,
    collection = createCollectionWithEnvironments([], format, rootDirectory),
) {
    return {
        getAncestorCollectionForPath: () => collection,
        getRegisteredCollections: () => [collection],
    } as unknown as TProvider;
}

/**
 * Creates a collection that contains the given items (and environments), together with an item provider stub for it.
 * The provider type is specific to each package, so it has to be passed as type argument.
 */
export function createCollectionWithItems<TProvider>(
    items: CollectionItem[],
    format: CollectionFormat,
    environmentNames: string[] = [],
) {
    const collection = createCollectionWithEnvironments(
        environmentNames.map((name) => ({ name })),
        format,
    );
    items.forEach((item) =>
        collection.addItem({ item, additionalData: undefined }),
    );

    return {
        collection,
        itemProvider: createItemProviderStub<TProvider>(
            collection.getRootDirectory(),
            format,
            collection,
        ),
    };
}
