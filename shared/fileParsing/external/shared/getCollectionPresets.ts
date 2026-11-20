import {
    CollectionFormat,
    getCollectionRootFilePath,
    getBrunoJsonSection,
    getFileContent,
    getYamlBrunoExtension,
    RequestType,
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
): CollectionPresets {
    return format == CollectionFormat.Bru
        ? getPresetsFromBrunoJson(fileContent)
        : getPresetsFromYaml(fileContent);
}

function getPresetsFromBrunoJson(fileContent: string) {
    const presets = getBrunoJsonSection(fileContent, "presets");

    return {
        requestType: toRequestType(presets?.requestType),
        requestUrl:
            typeof presets?.requestUrl == "string"
                ? presets.requestUrl
                : undefined,
    };
}

function getPresetsFromYaml(fileContent: string) {
    const request =
        getYamlBrunoExtension(fileContent)?.presets?.properties.request
            ?.properties;

    return {
        requestType: toRequestType(request?.type?.value),
        requestUrl: request?.url?.value,
    };
}

function toRequestType(presetType: unknown) {
    return Object.values(RequestType).find((type) => type == presetType);
}
