import {
    BrunoFileType,
    FileInfoProperty,
    getYamlCursorContext,
    isBrunoFileType,
    Logger,
    TopLevelEnvironmentFileProperty,
    YamlCursorContext,
} from "@global_shared";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import {
    LanguageRequestWithTestEnvironmentInfo,
    TypedCollection,
} from "../../shared";
import { getSequenceValueCompletion } from "../../shared/getSequenceValueCompletion";
import { getTagCompletions } from "../../shared/getTagCompletions";
import { getAvailableEnvironmentNamesForExtends } from "../../shared/getAvailableEnvironmentNamesForExtends";
import { getYamlFileTypeForEditorContent } from "../getYamlFileTypeForEditorContent";
import { getKeyCompletions, isOnlyKind } from "./getKeyCompletions";

const INFO_KEY = "info";

export async function handleCompletionRequest({
    baseRequest,
    collection,
    itemProvider,
    logger,
}: LanguageRequestWithTestEnvironmentInfo): Promise<
    CompletionItem[] | undefined
> {
    const { documentHelper, position, token, filePath } = baseRequest;
    const cachedItemType = collection
        .getStoredDataForPath(filePath)
        ?.item.getItemType();

    if (!cachedItemType || !isBrunoFileType(cachedItemType)) {
        return undefined;
    }

    const itemType = getYamlFileTypeForEditorContent(
        cachedItemType,
        documentHelper.getText(),
    );

    const context = getYamlCursorContext({
        docHelper: documentHelper,
        fileType: itemType,
        position,
    });

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    if (!context) {
        return undefined;
    }

    switch (context.kind) {
        case "key":
            return getKeyCompletions(context, {
                docHelper: documentHelper,
                fileType: itemType,
                getDefaultValue: (path) =>
                    isPath(path, [INFO_KEY, FileInfoProperty.Seq])
                        ? getSequenceValueCompletion(
                              collection,
                              filePath,
                              itemType,
                          )?.toString()
                        : undefined,
            });
        case "value":
            return getValueCompletions(context, {
                fileType: itemType,
                filePath,
                collection,
            });
        case "sequenceValue":
            return isPath(context.path, [INFO_KEY, FileInfoProperty.Tags])
                ? getTagCompletions({
                      itemProvider,
                      collection,
                      filePath,
                      alreadyDefinedTags: context.existingValues,
                  })
                : undefined;
    }
}

async function getValueCompletions(
    {
        path,
        keyInfo,
        replaceRange,
    }: Extract<YamlCursorContext, { kind: "value" }>,
    {
        fileType,
        filePath,
        collection,
    }: {
        fileType: BrunoFileType;
        filePath: string;
        collection: TypedCollection;
    },
): Promise<CompletionItem[] | undefined> {
    const toItem = (value: string): CompletionItem => ({
        label: value,
        kind: CompletionItemKind.Value,
        textEdit: { range: replaceRange, newText: value },
    });

    if (isPath(path, [INFO_KEY, FileInfoProperty.Seq])) {
        const sequence = getSequenceValueCompletion(
            collection,
            filePath,
            fileType,
        );
        return sequence === undefined ? [] : [toItem(sequence.toString())];
    }

    if (
        fileType == BrunoFileType.EnvironmentFile &&
        isPath(path, [TopLevelEnvironmentFileProperty.Extends])
    ) {
        return getAvailableEnvironmentNamesForExtends(filePath, collection).map(
            toItem,
        );
    }

    if (!keyInfo) {
        return undefined;
    }

    if (keyInfo.allowedValues) {
        return keyInfo.allowedValues.map(toItem);
    }

    return isOnlyKind(keyInfo.valueKinds, "boolean")
        ? ["true", "false"].map(toItem)
        : undefined;
}

function isPath(actual: string[], expected: string[]) {
    return (
        actual.length == expected.length &&
        actual.every((segment, i) => segment == expected[i])
    );
}

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for 'yaml' language.`,
    );
}
