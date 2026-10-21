import {
    BrunoFileType,
    FileInfoProperty,
    getYamlCursorContext,
    isBrunoFileType,
    hasVariableSupport,
    isCodeSection,
    isScriptVarsSection,
    isStartOfYamlPlainScalar,
    Logger,
    TopLevelEnvironmentFileProperty,
    TopLevelRequestFileProperty,
    VariableReferenceType,
    VariableScopeSectionKind,
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
import { getCompletionsForReadOnlyVariablesInNonCodeSection } from "../../shared/variables/getCompletionsForReadOnlyVariablesInNonCodeSection";
import { getCompletionsForVariableInCodeSection } from "../../shared/variables/getCompletionsForVariableInCodeSection";
import { getCompletionsForWriteOnlyVariablesInNonCodeSection } from "../../shared/variables/getCompletionsForWriteOnlyVariablesInNonCodeSection";
import { VariableSectionRequest } from "../../shared/variables/interfaces";
import { getVariableSectionRequest } from "../getVariableSectionRequest";
import { getYamlFileTypeForEditorContent } from "../getYamlFileTypeForEditorContent";
import { getKeyCompletions, isOnlyKind } from "./getKeyCompletions";

export async function handleCompletionRequest({
    baseRequest,
    collection,
    itemProvider,
    configuredEnvironmentName,
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

    const variableRequest = getVariableSectionRequest(
        baseRequest,
        collection,
        itemType,
        logger,
    );

    if (variableRequest) {
        const { kind } = variableRequest.file.sectionContainingPosition;

        if (isCodeSection(kind)) {
            // Within code sections, only variables are relevant.
            return getCompletionsForVariableInCodeSection(
                variableRequest,
                configuredEnvironmentName,
            );
        }

        if (!isScriptVarsSection(kind) && hasVariableSupport(kind)) {
            const variableCompletions =
                getCompletionsForReadOnlyVariablesInNonCodeSection(
                    variableRequest,
                    configuredEnvironmentName,
                    (rangeOfVariable) =>
                        isStartOfYamlPlainScalar(
                            documentHelper,
                            rangeOfVariable,
                        ),
                );

            if (variableCompletions.length > 0) {
                return variableCompletions;
            }
        }
    }

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
        case "key": {
            const items = getKeyCompletions(context, {
                docHelper: documentHelper,
                fileType: itemType,
                getDefaultValue: (path) =>
                    isPath(path, [
                        TopLevelRequestFileProperty.Info,
                        FileInfoProperty.Seq,
                    ])
                        ? getSequenceValueCompletion(
                              collection,
                              filePath,
                              itemType,
                          )?.toString()
                        : undefined,
                isCancellationRequested: () => token.isCancellationRequested,
            });

            if (!items) {
                addLogEntryForCancellation(logger);
            }
            return items;
        }
        case "value": {
            const variableNameCompletions = variableRequest
                ? getCompletionsForVariableNameValue(
                      context,
                      variableRequest,
                      configuredEnvironmentName,
                  )
                : undefined;
            if (variableNameCompletions) {
                return variableNameCompletions;
            }

            return getValueCompletions(context, {
                fileType: itemType,
                filePath,
                collection,
            });
        }
        case "sequenceValue":
            return isPath(context.path, [
                TopLevelRequestFileProperty.Info,
                FileInfoProperty.Tags,
            ])
                ? getTagCompletions({
                      itemProvider,
                      collection,
                      filePath,
                      alreadyDefinedTags: context.existingValues,
                  })
                : undefined;
    }
}

/**
 * Suggests the variable names that are read in scripts for the names of script variables (`variables[].name` and `actions[].variable.name`).
 *
 * @returns `undefined`, if the cursor is not at the name of a script variable.
 */
function getCompletionsForVariableNameValue(
    {
        path,
        replaceRange,
        isMissingSpaceAfterColon,
    }: Extract<YamlCursorContext, { kind: "value" }>,
    variableRequest: VariableSectionRequest,
    configuredEnvironment?: string,
): CompletionItem[] | undefined {
    const expectedKind = getKindOfScriptVariableNamePath(path);
    const section =
        variableRequest.file.sectionContainingPosition.kind == expectedKind
            ? variableRequest.file.sectionContainingPosition
            : variableRequest.file.allSections.find(
                  ({ kind }) => kind == expectedKind,
              );

    if (!section) {
        return undefined;
    }

    return getCompletionsForWriteOnlyVariablesInNonCodeSection(
        {
            ...variableRequest,
            file: {
                ...variableRequest.file,
                sectionContainingPosition: section,
            },
        },
        {
            variableRange: replaceRange,
            alreadyDefinedNames: section.variableReferences
                .filter(
                    ({ referenceType, variableNameRange }) =>
                        // Variables that are only read in the section (e.g. in `value`) are not defined by it.
                        referenceType == VariableReferenceType.Write &&
                        variableNameRange.start.line != replaceRange.start.line,
                )
                .map(({ variableName }) => variableName),
            getTextEdit: (variableName, rangeToReplace) => ({
                range: rangeToReplace,
                newText: isMissingSpaceAfterColon
                    ? ` ${variableName}`
                    : variableName,
            }),
        },
        configuredEnvironment,
    );
}

function getKindOfScriptVariableNamePath(path: string[]) {
    const [secondLast, last] = path.slice(-2);

    if (last != "name") {
        return undefined;
    }
    if (secondLast == "variables") {
        return VariableScopeSectionKind.PreRequestVars;
    }
    return secondLast == "variable"
        ? VariableScopeSectionKind.PostResponseVars
        : undefined;
}

async function getValueCompletions(
    {
        path,
        keyInfo,
        replaceRange,
        isMissingSpaceAfterColon,
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
        textEdit: {
            range: replaceRange,
            newText: isMissingSpaceAfterColon ? ` ${value}` : value,
        },
    });

    if (
        isPath(path, [TopLevelRequestFileProperty.Info, FileInfoProperty.Seq])
    ) {
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
