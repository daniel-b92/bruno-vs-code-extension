import {
    isAuthBlock,
    Block,
    RequestFileBlockName,
    Oauth2AdditionalParamsBlockNames,
    getSortedBlocksByPosition,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";
import { RelevantWithinAuthBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinAuthBlockDiagnosticCodeEnum";

export function checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (
        authBlocks.length > 1 ||
        (authBlocks.length == 1 &&
            authBlocks[0].name == RequestFileBlockName.OAuth2Auth)
    ) {
        return undefined;
    }

    const authBlock = authBlocks.length == 1 ? authBlocks[0] : undefined;
    const additionalParamsBlocks = blocks.filter(({ name }) =>
        (Object.values(Oauth2AdditionalParamsBlockNames) as string[]).includes(
            name,
        ),
    );

    if (additionalParamsBlocks.length > 0) {
        return authBlock
            ? getDiagnosticForExistingAuthBlock(
                  filePath,
                  additionalParamsBlocks,
                  authBlock,
              )
            : getDiagnosticForNonExistingAuthBlock(
                  filePath,
                  additionalParamsBlocks,
              );
    }
}

function getDiagnosticForExistingAuthBlock(
    filePath: string,
    additionalParamsBlocks: Block[],
    authBlock: Block,
): DiagnosticWithCode {
    return {
        ...getCommonDiagnosticsFields(),
        range: authBlock.nameRange,
        relatedInformation: additionalParamsBlocks.map(
            ({ name, nameRange }) => ({
                message: `Additional params block: '${name}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: nameRange,
                },
            }),
        ),
    };
}

function getDiagnosticForNonExistingAuthBlock(
    filePath: string,
    additionalParamsBlocks: Block[],
): DiagnosticWithCode {
    const sortedBlocksByPosition = getSortedBlocksByPosition(
        additionalParamsBlocks,
    );

    return {
        ...getCommonDiagnosticsFields(),
        range: sortedBlocksByPosition[0].nameRange,
        relatedInformation:
            sortedBlocksByPosition.length == 1
                ? undefined
                : sortedBlocksByPosition
                      .slice(1)
                      .map(({ name, nameRange }) => ({
                          message: `Other additional params block '${name}'`,
                          location: {
                              uri: URI.file(filePath).toString(),
                              range: nameRange,
                          },
                      })),
    };
}

function getCommonDiagnosticsFields() {
    return {
        message: "Additional params blocks only allowed for OAuth2 auth type.",
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinAuthBlockDiagnosticCode.AdditionalParamsFieldsDefinedWithoutOAuth2AuthType,
    };
}
