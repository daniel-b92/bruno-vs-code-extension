import {
    CollectionFormat,
    getCollectionRootFilePath,
    getFileContent,
    parseCollectionSettingsFile,
    RequestType,
    TextDocumentHelper,
} from "../../..";

export type CollectionPresets = {
    requestType?: RequestType;
    requestUrl?: string;
};

export async function getCollectionPresets(
    collectionRootFolder: string,
    format: CollectionFormat,
) {
    const fileContent = await getFileContent(
        getCollectionRootFilePath(collectionRootFolder, format),
    );

    return fileContent === undefined
        ? undefined
        : getCollectionPresetsFromFileContent(format, fileContent);
}

export function getCollectionPresetsFromFileContent(
    format: CollectionFormat,
    fileContent: string,
): CollectionPresets | undefined {
    return format == CollectionFormat.Bru
        ? getPresetsFromBrunoJson(fileContent)
        : getPresetsFromYaml(fileContent);
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

        return {
            requestType: toRequestType(requestType),
            requestUrl: typeof requestUrl == "string" ? requestUrl : undefined,
        };
    } catch {
        return undefined;
    }
}

function getPresetsFromYaml(fileContent: string) {
    const request = parseCollectionSettingsFile(
        new TextDocumentHelper(fileContent),
    ).result?.properties.extensions?.properties.bruno?.properties.presets
        ?.properties.request?.properties;

    return {
        requestType: toRequestType(request?.type?.value),
        requestUrl: request?.url?.value,
    };
}

function toRequestType(presetType: unknown) {
    return Object.values(RequestType).find((type) => type == presetType);
}
