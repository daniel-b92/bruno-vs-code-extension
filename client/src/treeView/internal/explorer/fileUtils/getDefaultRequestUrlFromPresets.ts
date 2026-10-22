import {
    BrunoPresetsRequestType,
    CollectionFormat,
    getCollectionRootFilePath,
    getFileContent,
    parseCollectionSettingsFile,
    RequestType,
    TextDocumentHelper,
} from "@global_shared";

/**
 * Returns the request URL that is configured in the collection-wide presets, if it applies to the given request type.
 */
export async function getDefaultRequestUrlFromPresets(
    collectionRootFolder: string,
    format: CollectionFormat,
    requestType: RequestType,
) {
    const fileContent = await getFileContent(
        getCollectionRootFilePath(collectionRootFolder, format),
    );

    if (fileContent === undefined) {
        return undefined;
    }

    const presets =
        format == CollectionFormat.Bru
            ? getPresetsFromBrunoJson(fileContent)
            : getPresetsFromYaml(fileContent);

    return presets?.type == requestType ? presets.url : undefined;
}

function getPresetsFromBrunoJson(fileContent: string) {
    try {
        const parsed = JSON.parse(fileContent) as unknown;

        if (
            typeof parsed != "object" ||
            parsed == null ||
            !("presets" in parsed) ||
            typeof parsed.presets != "object" ||
            parsed.presets == null
        ) {
            return undefined;
        }

        const { requestType, requestUrl } = parsed.presets as Record<
            string,
            unknown
        >;

        return typeof requestType == "string" && typeof requestUrl == "string"
            ? { type: requestType, url: requestUrl }
            : undefined;
    } catch {
        return undefined;
    }
}

function getPresetsFromYaml(fileContent: string) {
    const request = parseCollectionSettingsFile(
        new TextDocumentHelper(fileContent),
    ).result?.properties.extensions?.properties.bruno?.properties.presets
        ?.properties.request?.properties;

    const type = request?.type?.value;
    const url = request?.url?.value;

    return type !== undefined && url !== undefined
        ? { type: toRequestType(type), url }
        : undefined;
}

function toRequestType(presetType: BrunoPresetsRequestType) {
    return presetType == BrunoPresetsRequestType.Websocket
        ? RequestType.Ws
        : (presetType as string);
}
