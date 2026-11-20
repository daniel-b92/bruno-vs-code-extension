import { basename } from "path";
import { Document, isMap, isScalar, isSeq, parseDocument, Scalar } from "yaml";
import { isLineBreak, maskContent } from "../codeBlocks/maskContent";
import { wrapCodeBlock } from "../codeBlocks/wrapCodeBlock";
import { CodeBlockName, FileInfoType, ScriptType } from "../constants";

/**
 * Returns the content of a Yaml file from a Bruno collection the way it should be seen by the Typescript server.
 *
 * All characters that are not part of a script's code are replaced by spaces.
 * Line breaks are kept, so that all offsets and line / character positions are equal to the ones in the original content.
 * Each script is wrapped like a code block of a `.bru` file (see `wrapCodeBlock`), so that its declarations are scoped like at runtime
 * and the objects that are not available for the script are shadowed.
 *
 * Only the scripts returned by `getScriptContentRanges` are kept.
 */
export function maskYamlCollectionFileContent(
    fileName: string,
    fileContent: string,
) {
    const maskedCharacters = maskYamlFileContent(fileContent).split("");
    const { isGrpcRequest, scripts: scriptRanges } = parseScripts(
        fileName,
        fileContent,
    );
    let firstFreeIndex = 0;
    let suffix = "";

    for (const [index, { start, end, scriptType }] of scriptRanges.entries()) {
        const isLastScript = index == scriptRanges.length - 1;

        const openingBracketIndex = findLastIndexWithoutLineBreak(
            fileContent,
            firstFreeIndex,
            start,
        );
        const closingBracketIndex = findFirstIndexWithoutLineBreak(
            fileContent,
            end,
            isLastScript ? fileContent.length : scriptRanges[index + 1].start,
        );

        if (
            openingBracketIndex == undefined ||
            (closingBracketIndex == undefined && !isLastScript)
        ) {
            continue;
        }

        for (let i = start; i < end; i++) {
            maskedCharacters[i] = fileContent[i];
        }

        wrapCodeBlock(maskedCharacters, {
            blockName: mapScriptTypeToBlockName(scriptType),
            isGrpcRequest,
            code: fileContent.substring(start, end),
            fileContent,
            firstFreeIndex,
            openingBracketIndex,
        });

        if (closingBracketIndex == undefined) {
            // Appending characters at the end does not shift any positions.
            // A line break is needed if the script ends at the end of the file, since the closing bracket could otherwise be part of a line comment.
            suffix = isLineBreak(fileContent[fileContent.length - 1])
                ? "}"
                : "\n}";
        } else {
            maskedCharacters[closingBracketIndex] = "}";
            firstFreeIndex = closingBracketIndex + 1;
        }
    }

    return maskedCharacters.join("").concat(suffix);
}

/**
 * Replaces all characters except for line breaks by spaces, so that the Typescript server does not provide any language features for the file.
 */
export function maskYamlFileContent(fileContent: string) {
    return maskContent(fileContent);
}

/**
 * Scripts are defined in `runtime.scripts` for request files and in `request.scripts` for folder and collection settings files.
 *
 * The same scripts are returned as by `getScriptBlocksFromYamlFile` in the shared folder of the extension:
 * Only scripts with a valid type that are defined as literal block scalars (`code: |`) are included.
 * For all other scalar styles, the raw text in the file is not equal to the code (e.g. due to quotes or line folding).
 */
export function getScriptContentRanges(fileName: string, fileContent: string) {
    return parseScripts(fileName, fileContent).scripts;
}

/**
 * The request type is defined in `info.type` of request files. Folder and collection settings files are not specific to a request type.
 */
function parseScripts(fileName: string, fileContent: string) {
    const document = parseDocument(fileContent);
    const scripts = document.getIn(
        isSettingsFile(fileName, document)
            ? ["request", "scripts"]
            : ["runtime", "scripts"],
        true,
    );

    const parsedScripts = (isSeq(scripts) ? scripts.items : [])
        .flatMap((script) => {
            if (!isMap(script)) {
                return [];
            }

            const scriptType = script.get("type");

            if (!isValidScriptType(scriptType)) {
                return [];
            }

            const code = script.get("code", true);

            if (
                !isScalar(code) ||
                code.type != Scalar.BLOCK_LITERAL ||
                !code.range
            ) {
                return [];
            }

            const [headerStart, valueEnd] = code.range;
            const range = getContentRangeForBlockScalar(
                fileContent,
                headerStart,
                valueEnd,
            );

            return range ? [{ ...range, scriptType }] : [];
        })
        .sort(({ start: start1 }, { start: start2 }) => start1 - start2);

    return {
        isGrpcRequest: document.getIn(["info", "type"]) == FileInfoType.Grpc,
        scripts: parsedScripts,
    };
}

/**
 * Folder settings files are always named `folder.yml`.
 * The collection settings file is the only file that defines the top-level key `opencollection`.
 */
function isSettingsFile(fileName: string, document: Document) {
    return basename(fileName) == "folder.yml" || document.has("opencollection");
}

function isValidScriptType(type: unknown): type is ScriptType {
    return (Object.values(ScriptType) as unknown[]).includes(type);
}

function mapScriptTypeToBlockName(type: ScriptType) {
    switch (type) {
        case ScriptType.BeforeRequest:
            return CodeBlockName.PreRequestScript;
        case ScriptType.AfterResponse:
            return CodeBlockName.PostResponseScript;
        case ScriptType.Tests:
            return CodeBlockName.Tests;
    }
}

/**
 * The range of a block scalar node starts with the header (e.g. `|-`), which is followed by the content on the next lines.
 */
function getContentRangeForBlockScalar(
    fileContent: string,
    headerStart: number,
    valueEnd: number,
) {
    const lineBreakAfterHeader = /\r\n|\r|\n|\u2028|\u2029/g;
    lineBreakAfterHeader.lastIndex = headerStart;
    const match = lineBreakAfterHeader.exec(fileContent);

    if (!match) {
        return undefined;
    }

    const start = match.index + match[0].length;

    return start < valueEnd ? { start, end: valueEnd } : undefined;
}

function findLastIndexWithoutLineBreak(
    text: string,
    startIndex: number,
    endIndexExclusive: number,
) {
    for (let i = endIndexExclusive - 1; i >= startIndex; i--) {
        if (!isLineBreak(text[i])) {
            return i;
        }
    }

    return undefined;
}

function findFirstIndexWithoutLineBreak(
    text: string,
    startIndex: number,
    endIndexExclusive: number,
) {
    for (let i = startIndex; i < endIndexExclusive; i++) {
        if (!isLineBreak(text[i])) {
            return i;
        }
    }

    return undefined;
}
