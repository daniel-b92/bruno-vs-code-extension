import { URI } from "vscode-uri";
import { TypedCollectionItemProvider } from "../../shared";
import {
    BrunoFileType,
    getItemType,
    isBrunoFileType,
    parseBruFile,
    TextDocumentHelper,
} from "@global_shared";
import { TextEdit } from "vscode-languageserver";
import { updateUrlToMatchQueryParams } from "./updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./updatePathParamsKeysToMatchUrl";

export async function runUpdatesOnWillSave(
    fileUri: string,
    fileContent: string,
    itemProvider: TypedCollectionItemProvider,
): Promise<TextEdit[]> {
    const filePath = URI.parse(fileUri).fsPath;

    const brunoFileType = await getBrunoFileTypeIfExists(
        itemProvider,
        filePath,
    );

    // Only request files can have query params blocks and HTTP method blocks.
    if (brunoFileType == BrunoFileType.RequestFile) {
        const docHelper = new TextDocumentHelper(fileContent);
        const { blocks: parsedBlocks } = parseBruFile(docHelper);

        return ([] as TextEdit[]).concat(
            updateUrlToMatchQueryParams(parsedBlocks),
            updatePathParamsKeysToMatchUrl(docHelper, parsedBlocks),
        );
    }

    return [];
}

async function getBrunoFileTypeIfExists(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (!collection) {
        return undefined;
    }

    const itemType = await getItemType(collection, filePath);
    return itemType && isBrunoFileType(itemType) ? itemType : undefined;
}
