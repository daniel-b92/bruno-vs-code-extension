import { promisify } from "util";
import {
    TextDocumentHelper,
    parseBruFile,
    RequestFileBlockName,
    getFieldFromMetaBlock,
    MetaBlockKey,
} from "../../../../shared";
import { readFile, writeFile } from "fs";

export async function replaceNameInMetaBlock(
    filePath: string,
    newName: string
) {
    const documentHelper = new TextDocumentHelper(
        await promisify(readFile)(filePath, "utf-8")
    );

    const metaBlock = parseBruFile(documentHelper).blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta
    );

    if (metaBlock) {
        const nameField = getFieldFromMetaBlock(metaBlock, MetaBlockKey.Name);

        if (nameField) {
            await promisify(writeFile)(
                filePath,
                documentHelper.getFullTextWithReplacement(
                    {
                        lineIndex: nameField.valueRange.start.line,
                        startCharIndex: nameField.valueRange.start.character,
                        endCharIndex: nameField.valueRange.end.character,
                    },
                    newName
                )
            );
        }
    }
}
