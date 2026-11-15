import { Collection } from "../baseModel/collection";
import {
    CollectionFormat,
    CollectionItem,
    ItemType,
} from "../baseModel/interfaces";
import { getVariableScopeSectionsFromFile } from "../fileParsing/external/shared/getVariableScopeSectionsFromFile";
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
    // Tests can store arbitrary additional data in the items.
    const collection = new Collection<any>(
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
    rootDirectory?: string,
) {
    const collection = createCollectionWithEnvironments(
        environmentNames.map((name) => ({ name })),
        format,
        rootDirectory,
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

export interface ParsedCollectionFile {
    item: CollectionItem;
    /** If defined, the variable references of the content are stored as additional data of the item (like it is done for collections that are loaded from disk). */
    content?: string;
    /**
     * The file type, in which the content is parsed.
     * Needs to be set for directories, since their additional data is read from their settings file (`FolderSettingsFile` or `CollectionSettingsFile` for the root directory).
     * Defaults to the item type.
     */
    parsedAs?: ItemType;
}

/**
 * Like `createCollectionWithItems`, but stores the variable references of the file contents as additional data of the items.
 *  * The root directory is always registered by the collection itself, so an entry for it only sets its additional data.
 */
export function createCollectionWithParsedFiles<TProvider>(
    files: ParsedCollectionFile[],
    format: CollectionFormat,
    rootDirectory = "/collection",
) {
    const { collection, itemProvider } = createCollectionWithItems<TProvider>(
        [],
        format,
        [],
        rootDirectory,
    );

    for (const { item, content, parsedAs } of files) {
        const additionalData =
            content == undefined
                ? undefined
                : getVariableScopeSectionsFromFile(
                      content,
                      parsedAs ?? item.getItemType(),
                      format,
                  ).flatMap(({ kind, name, variableReferences }) =>
                      variableReferences.map((reference) => ({
                          reference,
                          sectionKind: kind,
                          sectionName: name,
                      })),
                  );
        const existingData = collection.getStoredDataForPath(item.getPath());

        if (existingData) {
            existingData.additionalData = additionalData;
        } else {
            collection.addItem({ item, additionalData });
        }
    }

    return { collection, itemProvider };
}
