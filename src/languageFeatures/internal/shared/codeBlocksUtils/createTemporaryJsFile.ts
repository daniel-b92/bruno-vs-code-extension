import { writeFileSync } from "fs";
import {
    parseBruFile,
    TextDocumentHelper,
    RequestFileBlockName,
} from "../../../../shared";
import { getTemporaryJsFileName } from "./getTemporaryJsFileName";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";

export function createTemporaryJsFile(
    collectionRootDirectory: string,
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

    writeFileSync(
        getTemporaryJsFileName(collectionRootDirectory, bruFileName),
        result.join("\n\n")
    );
}
