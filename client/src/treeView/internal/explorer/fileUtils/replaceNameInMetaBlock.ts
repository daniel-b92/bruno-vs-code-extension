import { promisify } from "util";
import {
    TextDocumentHelper,
    parseBruFile,
    RequestFileBlockName,
    MetaBlockKey,
    isDictionaryBlockSimpleField,
    getActiveFieldFromMetaBlock,
    ItemType,
    CollectionFormat,
    parseInfoFromYamlFile,
    BrunoFileType,
    Range,
} from "@global_shared";
import { readFile, writeFile } from "fs";
import { window } from "vscode";

export async function replaceNameInMetaBlock(
    filePath: string,
    newName: string,
    itemType: ItemType,
    format: CollectionFormat,
) {
    const fileContent = await promisify(readFile)(filePath, "utf-8").catch(
        () => undefined,
    );

    if (fileContent === undefined) {
        window.showErrorMessage(`An unexpected error occured.`);
        return;
    }

    const documentHelper = new TextDocumentHelper(fileContent);

    const nameRange =
        format == CollectionFormat.Yaml
            ? getNameRangeFromYamlFile(documentHelper, itemType)
            : getNameRangeFromBruFile(documentHelper, itemType);

    if (nameRange) {
        await promisify(writeFile)(
            filePath,
            documentHelper.getFullTextWithReplacement(
                {
                    lineIndex: nameRange.start.line,
                    startCharIndex: nameRange.start.character,
                    endCharIndex: nameRange.end.character,
                },
                newName,
            ),
        ).catch(() => {
            window.showErrorMessage(
                `An unexpected error occured while replacing name in meta block.`,
            );
        });
    }
}

function getNameRangeFromBruFile(
    documentHelper: TextDocumentHelper,
    itemType: ItemType,
): Range | undefined {
    const metaBlock = parseBruFile(documentHelper, itemType).blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta,
    );
    const nameField = metaBlock
        ? getActiveFieldFromMetaBlock(metaBlock, MetaBlockKey.Name)
        : undefined;

    return nameField && isDictionaryBlockSimpleField(nameField)
        ? nameField.valueRange
        : undefined;
}

function getNameRangeFromYamlFile(
    documentHelper: TextDocumentHelper,
    itemType: ItemType,
): Range | undefined {
    const parsed = parseInfoFromYamlFile(
        documentHelper,
        itemType as BrunoFileType,
    );

    return "result" in parsed
        ? parsed.result?.properties.name?.valueRange
        : undefined;
}
