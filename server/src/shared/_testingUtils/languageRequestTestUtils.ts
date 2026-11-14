import { CollectionFormat, Position, TextDocumentHelper } from "@global_shared";
import {
    createCollectionWithParsedFiles,
    ParsedCollectionFile,
} from "@global_shared/_testingUtils";
import { CancellationToken } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "..";
import { handleCompletionRequest as handleBruCompletionRequest } from "../../bruFiles/completions/handleCompletionRequest";
import { handleHoverRequest as handleBruHoverRequest } from "../../bruFiles/hover/handleHoverRequest";
import { handleCompletionRequest as handleYamlCompletionRequest } from "../../yamlFiles/completions/handleCompletionRequest";
import { handleHoverRequest as handleYamlHoverRequest } from "../../yamlFiles/hover/handleHoverRequest";

/** Marks the position, at which the language feature is requested. */
export const CURSOR = "§";

export interface TestFile extends ParsedCollectionFile {
    content: string;
    /** Is only set for the file at which the language feature is requested. */
    position?: Position;
}

/** Requests the completions for the `source` file, in a collection that consists of the `source` file and the `otherFiles`. */
export function requestCompletions(
    format: CollectionFormat,
    source: TestFile,
    otherFiles: TestFile[] = [],
) {
    const params = getLanguageRequest(format, source, otherFiles);

    return format == CollectionFormat.Bru
        ? handleBruCompletionRequest(params)
        : handleYamlCompletionRequest(params);
}

/** Requests the hover for the `source` file, in a collection that consists of the `source` file and the `otherFiles`. */
export function requestHover(
    format: CollectionFormat,
    source: TestFile,
    otherFiles: TestFile[] = [],
) {
    const params = getLanguageRequest(format, source, otherFiles);

    return format == CollectionFormat.Bru
        ? handleBruHoverRequest(params)
        : handleYamlHoverRequest(params);
}

/** Removes the cursor marker from the content (if there is one) and determines its position. */
export function toTestFile(
    file: ParsedCollectionFile & { content: string },
): TestFile {
    const index = file.content.indexOf(CURSOR);

    if (index < 0) {
        return file;
    }

    const linesBeforeCursor = file.content.slice(0, index).split("\n");

    return {
        ...file,
        content: file.content.replace(CURSOR, ""),
        position: new Position(
            linesBeforeCursor.length - 1,
            linesBeforeCursor[linesBeforeCursor.length - 1].length,
        ),
    };
}

function getLanguageRequest(
    format: CollectionFormat,
    source: TestFile,
    otherFiles: TestFile[],
) {
    const { collection, itemProvider } =
        createCollectionWithParsedFiles<TypedCollectionItemProvider>(
            [source, ...otherFiles],
            format,
        );

    return {
        baseRequest: {
            filePath: source.item.getPath(),
            documentHelper: new TextDocumentHelper(source.content),
            position: source.position ?? new Position(0, 0),
            token: CancellationToken.None,
        },
        collection,
        itemProvider,
    };
}
