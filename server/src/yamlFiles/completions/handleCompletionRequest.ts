import {
    BrunoFileType,
    FileInfoProperty,
    getYamlCursorContext,
    isBrunoFileType,
    LineBreakType,
    Logger,
    TextDocumentHelper,
    TopLevelEnvironmentFileProperty,
    YamlCursorContext,
    YamlExpectedKeyInfo,
    YamlValueKind,
} from "@global_shared";
import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
} from "vscode-languageserver";
import {
    LanguageRequestWithTestEnvironmentInfo,
    TypedCollection,
} from "../../shared";
import { getSequenceValueCompletion } from "../../shared/getSequenceValueCompletion";
import { getTagCompletions } from "../../shared/getTagCompletions";
import { getAvailableEnvironmentNamesForExtends } from "../../shared/getAvailableEnvironmentNamesForExtends";
import { getYamlFileTypeForEditorContent } from "../getYamlFileTypeForEditorContent";

const INDENTATION_STEP = 2;
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
            return getKeyCompletions(context, documentHelper);
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

function getKeyCompletions(
    {
        descriptor: { expectedKeys, definedKeys },
        replaceRange,
        indentation,
    }: Extract<YamlCursorContext, { kind: "key" }>,
    docHelper: TextDocumentHelper,
): CompletionItem[] {
    const lineBreak = docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

    return expectedKeys
        .filter(({ key }) => definedKeys.every((defined) => defined.key != key))
        .map((keyInfo) => {
            const { key, isMandatory } = keyInfo;
            const insertion = getKeyInsertion(
                keyInfo,
                lineBreak,
                indentation + INDENTATION_STEP,
            );

            return {
                label: key,
                kind: CompletionItemKind.Property,
                textEdit: { range: replaceRange, newText: insertion.text },
                insertTextFormat: insertion.isSnippet
                    ? InsertTextFormat.Snippet
                    : undefined,
                command: insertion.triggersValueSuggestion
                    ? {
                          title: "Suggest values",
                          command: "editor.action.triggerSuggest",
                      }
                    : undefined,
                sortText: isMandatory ? `a_${key}` : `b_${key}`,
                labelDetails: isMandatory ? undefined : { detail: " optional" },
            };
        });
}

function getKeyInsertion(
    { key, valueKinds, allowedValues }: YamlExpectedKeyInfo,
    lineBreak: LineBreakType,
    childIndentation: number,
) {
    const childPrefix = `${lineBreak}${" ".repeat(childIndentation)}`;

    if (isOnlyKind(valueKinds, "map")) {
        return { text: `${key}:${childPrefix}$0`, isSnippet: true };
    }

    if (isOnlyKind(valueKinds, "sequence")) {
        return { text: `${key}:${childPrefix}- $0`, isSnippet: true };
    }

    return {
        text: `${key}: `,
        isSnippet: false,
        triggersValueSuggestion:
            (allowedValues?.length ?? 0) > 0 ||
            isOnlyKind(valueKinds, "boolean"),
    };
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

function isOnlyKind(kinds: YamlValueKind[], kind: YamlValueKind) {
    return kinds.length > 0 && kinds.every((k) => k == kind);
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
