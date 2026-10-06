import {
    BrunoEnvironmentFile,
    BrunoFileType,
    BrunoRequestFile,
    ParsedEnvironmentVariable,
    TextDocumentHelper,
    getFileContent,
    parseInfoFromYamlFile,
    parseYamlEnvironmentFile,
} from "../../..";

export async function createYamlRequestFileInstance(path: string) {
    const content = await getFileContent(path);

    if (content === undefined) {
        return undefined;
    }

    const infoProperties = parseInfoFromYamlFile(
        new TextDocumentHelper(content),
        BrunoFileType.RequestFile,
    ).result?.properties;

    return new BrunoRequestFile(
        path,
        infoProperties?.sequence?.value,
        infoProperties?.tags?.value.map(({ value }) => value),
    );
}

export async function getSequenceFromYamlFolderSettingsFile(path: string) {
    const content = await getFileContent(path);

    return content === undefined
        ? undefined
        : parseInfoFromYamlFile(
              new TextDocumentHelper(content),
              BrunoFileType.FolderSettingsFile,
          ).result?.properties.sequence?.value;
}

export async function createYamlEnvironmentFileInstance(path: string) {
    const content = await getFileContent(path);

    if (content === undefined) {
        return new BrunoEnvironmentFile(path, []);
    }

    const properties = parseYamlEnvironmentFile(new TextDocumentHelper(content))
        .result?.properties;

    return new BrunoEnvironmentFile(
        path,
        (properties?.variables?.enabled ?? []).flatMap(mapEnvironmentVariable),
        properties?.extends?.value,
    );
}

function mapEnvironmentVariable({ properties }: ParsedEnvironmentVariable) {
    const { name, value } = properties;

    if (!name || !value) {
        // E.g. secret variables do not have any value.
        return [];
    }

    const valueData =
        "properties" in value ? value.properties.data : value;

    return valueData
        ? [
              {
                  key: name.value,
                  keyRange: name.valueRange,
                  value: valueData.value,
                  valueRange: valueData.valueRange,
              },
          ]
        : [];
}
