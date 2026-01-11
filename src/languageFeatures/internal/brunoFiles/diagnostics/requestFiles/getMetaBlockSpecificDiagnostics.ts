import { DiagnosticSeverity, Uri, Range as VsCodeRange } from "vscode";
import {
    TextDocumentHelper,
    Block,
    MetaBlockKey,
    RequestType,
    CollectionItemProvider,
    isDictionaryBlockSimpleField,
    shouldBeDictionaryArrayField,
    RequestFileBlockName,
    DictionaryBlock,
    isDictionaryBlockArrayField,
    DictionaryBlockArrayField,
    Range,
    mapToVsCodePosition,
    mapToVsCodeRange,
} from "../../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { checkMetaBlockStartsInFirstLine } from "../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkSequenceInMetaBlockIsValid } from "../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { checkDictionaryBlockArrayFieldsStructure } from "../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsStructure";
import { checkDictionaryBlockArrayFieldsValues } from "../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsValues";
import { RelevantWithinSettingsBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinSettingsBlockDiagnosticCodeEnum";

export async function getMetaBlockSpecificDiagnostics(
    itemProvider: CollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    metaBlock: DictionaryBlock,
): Promise<(DiagnosticWithCode | undefined)[]> {
    const mandatoryBlockKeys = [
        MetaBlockKey.Name,
        MetaBlockKey.Sequence,
        MetaBlockKey.Type,
    ];
    const optionalBlockKeys = [MetaBlockKey.Tags];
    const typeFields = metaBlock.content.filter(
        ({ key }) => key == MetaBlockKey.Type,
    );
    const tagsFields = metaBlock.content.filter(
        ({ key }) => key == MetaBlockKey.Tags,
    );

    const diagnostics = [
        checkSequenceInMetaBlockIsValid(metaBlock),
        checkNoKeysAreMissingForDictionaryBlock(
            metaBlock,
            mandatoryBlockKeys,
            RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            metaBlock,
            mandatoryBlockKeys.concat(optionalBlockKeys),
            RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
        ),
        checkNoMandatoryValuesAreMissingForDictionaryBlock(
            metaBlock,
            [MetaBlockKey.Name],
            RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            metaBlock,
            mandatoryBlockKeys.concat(optionalBlockKeys),
            RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
        ),
        checkDictionaryBlockArrayFieldsStructure(
            documentUri,
            metaBlock,
            metaBlock.content
                .map(({ key }) => key)
                .filter((existing) =>
                    shouldBeDictionaryArrayField(
                        RequestFileBlockName.Meta,
                        existing,
                    ),
                ),
        ),
        typeFields.length == 1 && isDictionaryBlockSimpleField(typeFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  typeFields[0],
                  Object.values(RequestType),
                  RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid,
              )
            : undefined,
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
    ].concat(
        tagsFields.length == 1 && isDictionaryBlockArrayField(tagsFields[0])
            ? runChecksForTagsField(documentUri, tagsFields[0])
            : [],
    );

    for (const results of await provideRelatedFilesDiagnosticsForMetaBlock(
        itemProvider,
        metaBlock,
        documentUri,
        relatedFilesHelper,
    )) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

async function provideRelatedFilesDiagnosticsForMetaBlock(
    itemProvider: CollectionItemProvider,
    metaBlock: Block,
    documentUri: Uri,
    relatedRequestsHelper: RelatedFilesDiagnosticsHelper,
): Promise<
    {
        uri: Uri;
        result: DiagnosticWithCode;
    }[]
> {
    const { code, toAdd } = await checkSequenceInMetaBlockIsUniqueWithinFolder(
        itemProvider,
        metaBlock,
        documentUri,
    );

    if (toAdd) {
        relatedRequestsHelper.registerDiagnostic({
            files: toAdd.affectedFiles,
            diagnosticCode: code,
        });

        return [{ uri: documentUri, result: toAdd.diagnosticCurrentFile }];
    } else {
        relatedRequestsHelper.unregisterDiagnostic(documentUri.fsPath, code);
        return [];
    }
}

function runChecksForTagsField(
    documentUri: Uri,
    tagsField: DictionaryBlockArrayField,
) {
    const duplicateValues = tagsField.values.reduce(
        (prev, { content, range }, index) => {
            const indexForEntryForSameValue = tagsField.values
                .slice(0, index)
                .findIndex(
                    ({ content: prevEntryValue }) => content == prevEntryValue,
                );

            if (indexForEntryForSameValue < 0) {
                return prev;
            }

            const indexForEntryFromResult = prev.findIndex(
                ({ value: prevEntryValue }) => content == prevEntryValue,
            );

            return indexForEntryFromResult >= 0
                ? prev.map((val, index) =>
                      index == indexForEntryForSameValue
                          ? { ...val, ranges: val.ranges.concat(range) }
                          : val,
                  )
                : prev.concat({
                      value: content,
                      ranges: [
                          tagsField.values[indexForEntryForSameValue].range,
                          range,
                      ],
                  });
        },
        [] as { value: string; ranges: Range[] }[],
    );

    return [
        checkDictionaryBlockArrayFieldsValues(documentUri, [tagsField]),
    ].concat(
        duplicateValues.length > 0
            ? {
                  message: `Some values are defined multiple times: '${duplicateValues
                      .map(({ value }) => value)
                      .join("', '")}'.`,
                  range: getRangeForDuplicateTagsDiagnostic(duplicateValues),
                  severity: DiagnosticSeverity.Error,
                  code: RelevantWithinSettingsBlockDiagnosticCode.DuplicateTagsDefined,
                  relatedInformation: duplicateValues
                      .map(({ value, ranges }) => ({
                          value,
                          ranges: ranges.sort(compareRanges).slice(0, -1),
                      }))
                      .flatMap(({ value, ranges }) =>
                          ranges.map((range) => ({
                              message: `Previous definition for tag '${value}'`,
                              location: {
                                  uri: documentUri,
                                  range: mapToVsCodeRange(range),
                              },
                          })),
                      ),
              }
            : undefined,
    );
}

function getRangeForDuplicateTagsDiagnostic(
    duplicateValues: { value: string; ranges: Range[] }[],
) {
    const onlyLatestRangesSortedByPostion = duplicateValues
        .map(({ value, ranges }) => ({
            value,
            range: ranges.sort(compareRanges).slice(-1)[0],
        }))
        .sort(({ range: range1 }, { range: range2 }) =>
            compareRanges(range1, range2),
        );

    return new VsCodeRange(
        mapToVsCodePosition(onlyLatestRangesSortedByPostion[0].range.start),
        mapToVsCodePosition(
            onlyLatestRangesSortedByPostion.slice(-1)[0].range.end,
        ),
    );
}

function compareRanges(range1: Range, range2: Range) {
    return range1.start.isBefore(range2.start) ? -1 : 1;
}
