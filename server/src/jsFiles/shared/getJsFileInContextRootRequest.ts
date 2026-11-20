import {
    getDefaultLogger,
    JsFileInContextRootRequest,
    LanguageFeatureBaseRequest,
    TypedCollection,
    TypedCollectionItemProvider,
} from "../../shared";

/** Returns the request for a JS file that is not part of a collection, but within `additionalContextRoots` of at least one collection. */
export async function getJsFileInContextRootRequest(
    itemProvider: Pick<
        TypedCollectionItemProvider,
        "getCollectionsWithAdditionalContextRootContainingItem"
    >,
    baseRequest: LanguageFeatureBaseRequest,
    getConfiguredEnvironmentName: (
        collection: TypedCollection,
    ) => Promise<string | undefined>,
): Promise<JsFileInContextRootRequest | undefined> {
    const collectionsForContextRoot =
        itemProvider.getCollectionsWithAdditionalContextRootContainingItem(
            baseRequest.filePath,
        );

    return collectionsForContextRoot.length > 0
        ? {
              baseRequest,
              collections: await Promise.all(
                  collectionsForContextRoot.map(async (collection) => ({
                      collection,
                      configuredEnvironmentName:
                          await getConfiguredEnvironmentName(collection),
                  })),
              ),
              logger: getDefaultLogger(),
          }
        : undefined;
}
