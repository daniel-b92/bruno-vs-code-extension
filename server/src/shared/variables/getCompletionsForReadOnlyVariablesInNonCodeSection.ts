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
    configuredEnvironment?: string,
    /** Characters that can never be part of a variable name, e.g. the quotes that surround a Yaml string. */
    nonVariableNameCharacters = "",
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
        nonVariableNameCharacters,
        logger,
    );
    if (!variableParsingResult) {
        return [];
    }

    const { variable, toAppendOnInsertion } = variableParsingResult;

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

    return mapVariablesToCompletions(
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
        (variableName: string, rangeToReplace: Range) => ({
            newText: `${variableName}${toAppendOnInsertion}`,
            range: rangeToReplace,
        }),
    );
}

function getVariable(
    { position, token }: LanguageFeatureBaseRequest,
    lineContent: string,
    nonVariableNameCharacters: string,
    logger?: Logger,
) {
    const { character, line } = position;
    const matchingTextResult = getMatchingTextContainingPosition(
        position,
        lineContent,
        new RegExp(
            `{{[^{}\\s${escapeForCharacterClass(nonVariableNameCharacters)}]*`,
        ),
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

    return {
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

function addLogEntryForCancellation(logger?: Logger) {
    logger?.debug(
        `Cancellation requested for completion provider for variables.`,
    );
}

function escapeForCharacterClass(characters: string) {
    return characters.replace(/[\\\]^-]/g, "\\$&");
}
