import { promisify } from "util";
import {
    TextDocumentHelper,
    parseBruFile,
    RequestFileBlockName,
    MetaBlockKey,
    isDictionaryBlockSimpleField,
    getActiveFieldFromMetaBlock,
} from "@global_shared";
import { readFile, writeFile } from "fs";
import { window } from "vscode";

export async function replaceNameInMetaBlock(
    filePath: string,
    newName: string,
) {
    const fileContent = await promisify(readFile)(filePath, "utf-8").catch(
        () => undefined,
    );

    if (fileContent === undefined) {
        window.showErrorMessage(`An unexpected error occured.`);
        return;
    }

    const documentHelper = new TextDocumentHelper(fileContent);

    const metaBlock = parseBruFile(documentHelper).blocks.find(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (metaBlock) {
        const nameField = getActiveFieldFromMetaBlock(
            metaBlock,
            MetaBlockKey.Name,
        );

        if (nameField && isDictionaryBlockSimpleField(nameField)) {
            await promisify(writeFile)(
                filePath,
                documentHelper.getFullTextWithReplacement(
                    {
                        lineIndex: nameField.valueRange.start.line,
                        startCharIndex: nameField.valueRange.start.character,
                        endCharIndex: nameField.valueRange.end.character,
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
}
