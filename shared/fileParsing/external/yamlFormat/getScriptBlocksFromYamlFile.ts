import { BrunoFileType, ItemType, Range, TextDocumentHelper } from "../../..";
import { ParsedScript } from "../../internal/yamlFormat/interfaces";
import { getBlockScalarContentRange } from "./getBlockScalarContentRange";
import { FileInfoType, ScriptType } from "./constants/sharedConstants";
import { parseCollectionSettingsFile } from "./parseCollectionSettingsFile";
import { parseFolderSettingsFile } from "./parseFolderSettingsFile";
import { parseRequestFile } from "./parseRequestFile";

export interface YamlScriptBlock {
    /** Unique within the file, e.g. `scripts[1]:after-response`. */
    name: string;
    scriptType: ScriptType;
    /** The raw lines of the literal block scalar (including the indentation). */
    content: string;
    contentRange: Range;
}

/**
 * Only scripts defined as literal block scalars (`code: |`) are returned.
 * For all other scalar styles, the raw text in the document is not equal to the code (e.g. due to quotes or line folding).
 */
export function getScriptBlocksFromYamlFile(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
): { requestType?: FileInfoType; blocks: YamlScriptBlock[] } {
    const { scripts, requestType } = parseScripts(docHelper, itemType);

    return {
        requestType,
        blocks: scripts.flatMap((script, index) => {
            const block = mapToBlock(script, index, docHelper);
            return block ? [block] : [];
        }),
    };
}

function parseScripts(docHelper: TextDocumentHelper, itemType: ItemType) {
    switch (itemType) {
        case BrunoFileType.RequestFile: {
            const { properties } = parseRequestFile(docHelper).result ?? {};
            return {
                scripts: properties?.runtime?.properties.scripts ?? [],
                requestType: properties?.info?.properties.type?.value,
            };
        }
        case BrunoFileType.FolderSettingsFile:
            return {
                scripts:
                    parseFolderSettingsFile(docHelper).result?.properties
                        .request?.properties.scripts ?? [],
            };
        case BrunoFileType.CollectionSettingsFile:
            return {
                scripts:
                    parseCollectionSettingsFile(docHelper).result?.properties
                        .request?.properties.scripts ?? [],
            };
        default:
            return { scripts: [] };
    }
}

function mapToBlock(
    { properties: { code, type } }: ParsedScript,
    index: number,
    docHelper: TextDocumentHelper,
): YamlScriptBlock | undefined {
    if (!code || !code.isLiteralBlockScalar || !type) {
        return undefined;
    }

    const contentRange = getBlockScalarContentRange(
        code.valueRange.start.line,
        code.valueRange.end,
        docHelper,
    );

    if (!contentRange) {
        return undefined;
    }

    return {
        name: `scripts[${index}]:${type.value}`,
        scriptType: type.value,
        content: docHelper.getText(contentRange),
        contentRange,
    };
}
