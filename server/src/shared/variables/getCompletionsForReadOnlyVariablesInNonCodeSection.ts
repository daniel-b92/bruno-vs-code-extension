import {
    BrunoVariableType,
    getMatchingTextContainingPosition,
    LineBreakType,
    Logger,
    Position,
    Range,
    VariableReferenceType,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "..";
import { getAllVariableReferences } from "./getAllVariableReferences";
import { VariableSectionRequest } from "./interfaces";
import { mapVariablesToCompletions } from "./mapVariablesToCompletions";

export function getCompletionsForReadOnlyVariablesInNonCodeSection(
    fullRequest: VariableSectionRequest,
    configuredEnvironment: string | undefined,
    /**
     * In Yaml, a plain scalar starting with `{{` would be read as a flow mapping instead of a string.
     * Determines whether the given range (the opening braces up to the end of the variable) is the start of a plain scalar and needs to be quoted.
     */
    isQuotingRequired: (rangeOfVariable: Range) => boolean,
) {
    const { request, logger } = fullRequest;
    const { documentHelper, position } = request;
    const { line } = position;
    const functionType = VariableReferenceType.Read;
    // In non-code blocks with read-only variables, all kinds of variables can be accessed via the same syntax.
    const variableType = BrunoVariableType.Unknown;
    const lineContent = documentHelper.getLineByIndex(line);

    const variableParsingResult = getVariable(
        request,
        lineContent,
        isQuotingRequired,
        logger,
    );
    if (!variableParsingResult) {
        return [];
    }

    const { variable, toAppendOnInsertion, quotedValueRange } =
        variableParsingResult;

    const allRefs = getAllVariableReferences(
        fullRequest,
        {
            referenceType: functionType,
            variableType,
        },
        {
            configuredEnvironment,
        },
    );

    if (!allRefs) {
        return [];
    }

    const {
        staticReferences: { fromEnvironmentFiles },
        dynamicReferences: { withinSameFile, fromOtherFiles },
    } = allRefs;

    const completions = mapVariablesToCompletions(
        {
            staticEnvVariables: fromEnvironmentFiles.map(
                ({
                    file,
                    matchingVariables,
                    isConfiguredEnv,
                    inheritedByEnvironmentName,
                }) => ({
                    environmentFile: file,
                    matchingVariableKeys: matchingVariables.map(
                        ({ key }) => key,
                    ),
                    isConfiguredEnv,
                    inheritedByEnvironmentName,
                }),
            ),
            dynamicVariables: {
                fromSameFile: withinSameFile,
                fromOtherFiles,
            },
        },
        {
            variable,
            functionType,
            variableType,
            documentLineBreak:
                documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
        },
        (variableName: string, rangeToReplace: Range) =>
            quotedValueRange
                ? {
                      newText: `"{{${variableName}}}"`,
                      range: quotedValueRange,
                  }
                : {
                      newText: `${variableName}${toAppendOnInsertion}`,
                      range: rangeToReplace,
                  },
    );

    // The text edit starts at the opening braces, so the filtering has to take them into account.
    return quotedValueRange
        ? completions.map((item) => ({
              ...item,
              filterText: `{{${item.label}`,
          }))
        : completions;
}

function getVariable(
    { position, token }: LanguageFeatureBaseRequest,
    lineContent: string,
    isQuotingRequired: (rangeOfVariable: Range) => boolean,
    logger?: Logger,
) {
    const { character, line } = position;
    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        lineContent,
        // Quotes can never be part of a variable name, so a closing quote of a surrounding string is not treated as such.
        /{{[^{}\s"']*/,
    );

    if (!matchingTextResult) {
        return undefined;
    }

    const {
        text: matchingText,
        startChar,
        endChar: endCharForMatchingText,
    } = matchingTextResult;
    // If the position is not after both starting brackets, provided completions would be inserted in an invalid location.
    if (character < startChar + 2 || character > endCharForMatchingText) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    // Avoid overwriting content that may not be directly related to the variable.
    const endCharForInsertion = Math.min(
        endCharForMatchingText,
        position.character,
    );

    const textBehindInsertion = lineContent.substring(endCharForInsertion);
    const hasClosingBraces = textBehindInsertion.startsWith("}}");
    const textBehindVariable = textBehindInsertion.substring(
        hasClosingBraces ? 2 : 0,
    );
    const rangeOfVariable = new Range(
        new Position(line, startChar),
        new Position(line, endCharForInsertion + (hasClosingBraces ? 2 : 0)),
    );
    // If more text follows the variable, it is not the whole value, so wrapping it in quotes would not be correct.
    const isOnlyContentOfValue =
        COMMENT_OR_BLANK_REGEX.test(textBehindVariable);

    return {
        quotedValueRange:
            isOnlyContentOfValue &&
            isQuotingRequired(rangeOfVariable)
                ? rangeOfVariable
                : undefined,
        variable: {
            name: matchingText.substring(2),
            start: new Position(line, startChar + 2),
            end: new Position(line, endCharForInsertion),
        },
        toAppendOnInsertion: !lineContent
            .substring(endCharForInsertion)
            .startsWith("}")
            ? "}}"
            : "",
    };
}

/** Matches text that is empty or only consists of a trailing comment. */
const COMMENT_OR_BLANK_REGEX = /^\s*(#.*)?$/;

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for variables.`,
    );
}
