import { writeFileSync } from "fs";
import {
    parseBruFile,
    TextDocumentHelper,
    RequestFileBlockName,
} from "../../../../shared";
import { getTemporaryJsFileName } from "./getTemporaryJsFileName";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";

export function createTemporaryJsFile(
    collectionRootDirectory: string,
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    bruFileName: string,
    bruFileContent: string
) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent)
    );
    const blocksWithJsCode = parsedBlocks.filter(({ name }) =>
        (
            [
                RequestFileBlockName.PreRequestScript,
                RequestFileBlockName.PostResponseScript,
                RequestFileBlockName.Tests,
            ] as string[]
        ).includes(name)
    );
    const result: string[] = [];

    for (const { name, content } of blocksWithJsCode) {
        result.push(
            `${mapBlockNameToJsFileLine(name as RequestFileBlockName)}
${content}}`
        );
    }

    const fileName = getTemporaryJsFileName(
        collectionRootDirectory,
        bruFileName
    );

    writeFileSync(fileName, result.join("\n\n"));
    tempJsFilesRegistry.registerJsFile(fileName);
}
