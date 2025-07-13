import { readFileSync, writeFileSync } from "fs";
import {
    TextDocumentHelper,
    parseBruFile,
    RequestFileBlockName,
    getFieldFromMetaBlock,
    MetaBlockKey,
} from "../../../../shared";

export function replaceNameInMetaBlock(filePath: string, newName: string) {
    const documentHelper = new TextDocumentHelper(
        readFileSync(filePath).toString()
    );

    const metaBlock = parseBruFile(documentHelper).blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta
    );

    if (metaBlock) {
        const nameField = getFieldFromMetaBlock(metaBlock, MetaBlockKey.Name);

        if (nameField) {
            writeFileSync(
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
