import { BrunoFileType, ItemType, Range, TextDocumentHelper } from "../../..";
import { YamlParsingOptions } from "./interfaces";
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
    /** The raw lines of the literal block scalar (including the indentation) or the text of the single-line plain scalar. */
    content: string;
    contentRange: Range;
}

export interface YamlScriptBlockOptions extends YamlParsingOptions {
    /**
     * If true, scripts defined as single-line plain scalars (`code: bru.getVar("a");`) are returned as well.
     * Their content range starts within the line of the `code` key, so it does not consist of whole lines.
     */
    includeSingleLinePlainScalars?: boolean;
}

/**
 * Only scripts defined as literal block scalars (`code: |`) are returned (and optionally single-line plain scalars).
 * For all other scalar styles, the raw text in the document is not equal to the code (e.g. due to quotes or line folding).
 */
export function getScriptBlocksFromYamlFile(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
    options?: YamlScriptBlockOptions,
): { requestType?: FileInfoType; blocks: YamlScriptBlock[] } {
    const { scripts, requestType } = parseScripts(docHelper, itemType, options);

    return {
        requestType,
        blocks: scripts.flatMap((script, index) => {
            const block = mapToBlock(
                script,
                index,
                docHelper,
                options?.includeSingleLinePlainScalars ?? false,
            );
            return block ? [block] : [];
        }),
    };
}

function parseScripts(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
    options?: YamlParsingOptions,
) {
    switch (itemType) {
        case BrunoFileType.RequestFile: {
            const { properties } =
                parseRequestFile(docHelper, options).result ?? {};
            return {
                scripts: properties?.runtime?.properties.scripts ?? [],
                requestType: properties?.info?.properties.type?.value,
            };
        }
        case BrunoFileType.FolderSettingsFile:
            return {
                scripts:
                    parseFolderSettingsFile(docHelper, options).result
                        ?.properties.request?.properties.scripts ?? [],
            };
        case BrunoFileType.CollectionSettingsFile:
            return {
                scripts:
                    parseCollectionSettingsFile(docHelper, options).result
                        ?.properties.request?.properties.scripts ?? [],
            };
        default:
            return { scripts: [] };
    }
}

function mapToBlock(
    { properties: { code, type } }: ParsedScript,
    index: number,
    docHelper: TextDocumentHelper,
    includeSingleLinePlainScalars: boolean,
): YamlScriptBlock | undefined {
    if (!code || !type) {
        return undefined;
    }

    const { valueRange } = code;
    const contentRange = code.isLiteralBlockScalar
        ? getBlockScalarContentRange(
              valueRange.start.line,
              valueRange.end,
              docHelper,
          )
        : includeSingleLinePlainScalars &&
            code.isPlainScalar &&
            valueRange.start.line == valueRange.end.line
          ? valueRange
          : undefined;

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
