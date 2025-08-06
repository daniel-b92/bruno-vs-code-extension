import {
    Block,
    castBlockToTextBlock,
    Position,
    Range,
    TextDocumentHelper,
    VariableReference,
} from "../../..";

export function getSetEnvironmentVariablesForBlock(codeBlock: Block) {
    const castedBlock = castBlockToTextBlock(codeBlock);

    if (!castedBlock) {
        throw new Error(
            `Could not determine set environment variables within block since it's not a code block: ${JSON.stringify(codeBlock, null, 2)}`,
        );
    }

    const documentHelper = new TextDocumentHelper(castedBlock.content);
    const linesInBlock = documentHelper.getAllLines();

    const result: VariableReference[] = [];

    for (const { content, index: indexInBlock } of linesInBlock) {
        const definedVars = getSetEnvironmentVariablesInLine(content);

        if (definedVars.length > 0) {
            const lineIndexInFile =
                codeBlock.contentRange.start.line + indexInBlock;

            result.push(
                ...definedVars.map(({ name, startIndex, endIndex }) => ({
                    name,
                    range: new Range(
                        new Position(lineIndexInFile, startIndex),
                        new Position(lineIndexInFile, endIndex),
                    ),
                })),
            );
        }
    }

    return result;
}

function getSetEnvironmentVariablesInLine(content: string) {
    const textToSearch = "bru.setEnvVar(";

    if (!content.includes(textToSearch)) {
        return [];
    }

    const toMatch = new RegExp(
        `${textToSearch.replace(".", "\\.")}\\(("\\S+"|\\('\\S+'|\\(\`\\S+\`),.+\\)`,
    );

    const matches = toMatch.exec(content);

    if (!matches) {
        return [];
    }

    return matches.map((name) => ({
        name,
        startIndex: content.indexOf(name),
        endIndex: content.indexOf(name) + name.length,
    }));
}
