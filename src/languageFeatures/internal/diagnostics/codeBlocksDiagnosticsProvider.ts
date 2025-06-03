import { Diagnostic, languages } from "vscode";
import { Block, Collection } from "../../../shared";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { TemporaryJsFilesRegistry } from "../shared/temporaryJsFilesRegistry";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";

export class CodeBlocksDiagnosticsProvider {
    constructor() {}

    public async mapDiagnosticsFromTempJsFile(
        tempJsFilesRegistry: TemporaryJsFilesRegistry,
        collection: Collection,
        fullBruFileContent: string,
        codeBlocks: Block[]
    ): Promise<Diagnostic[]> {
        if (codeBlocks.length == 0) {
            return [];
        }
        const temporaryJsDoc = await waitForTempJsFileToBeInSync(
            tempJsFilesRegistry,
            collection,
            fullBruFileContent,
            codeBlocks
        );

        return languages
            .getDiagnostics()
            .filter(({ "0": uri }) => uri.fsPath == temporaryJsDoc.fileName)
            .map(({ "1": diagnostic }) => diagnostic)
            .flat()
            .map((diagnostic) => {
                const mappedRange = mapToRangeWithinBruFile(
                    codeBlocks,
                    temporaryJsDoc.getText(),
                    diagnostic.range
                );

                return mappedRange
                    ? {
                          ...diagnostic,
                          range: mappedRange,
                          relatedInformation:
                              !diagnostic.relatedInformation ||
                              diagnostic.relatedInformation.length == 0
                                  ? undefined
                                  : diagnostic.relatedInformation
                                        .map(
                                            ({
                                                message,
                                                location: { uri, range },
                                            }) => {
                                                const mappedRelatedInfoRange =
                                                    mapToRangeWithinBruFile(
                                                        codeBlocks,
                                                        temporaryJsDoc.getText(),
                                                        range
                                                    );
                                                return mappedRelatedInfoRange
                                                    ? {
                                                          message,
                                                          location: {
                                                              uri,
                                                              range: mappedRelatedInfoRange,
                                                          },
                                                      }
                                                    : undefined;
                                            }
                                        )
                                        .filter((val) => val != undefined),
                      }
                    : undefined;
            })
            .filter((val) => val != undefined);
    }

    public dispose() {}
}
