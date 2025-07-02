import { readFileSync, writeFileSync } from "fs";
import { extname, basename } from "path";
import {
    TextDocumentHelper,
    parseBruFile,
    RequestFileBlockName,
    getFieldFromMetaBlock,
    MetaBlockKey,
} from "../../../shared";

export function replaceNameInRequestFile(filePath: string) {
    const documentHelper = new TextDocumentHelper(
        readFileSync(filePath).toString()
    );

    const metaBlock = parseBruFile(documentHelper).blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta
    );

    if (metaBlock) {
        const nameField = getFieldFromMetaBlock(metaBlock, MetaBlockKey.Name);

        const newName =
            extname(filePath).length > 0
                ? basename(filePath).substring(
                      0,
                      basename(filePath).indexOf(extname(basename(filePath)))
                  )
                : basename(filePath);

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
