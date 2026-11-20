import {
    BrunoFileType,
    getVariableScopeSectionsFromYamlFile,
    Logger,
    ParsedYamlDocument,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../shared";
import { VariableSectionRequest } from "../shared/variables/interfaces";

/**
 * @param parsedDocument If defined, it is used instead of parsing the document text again.
 * @returns `undefined`, if the position is not within any section that can be handled.
 */
export function getVariableSectionRequest(
    request: LanguageFeatureBaseRequest,
    collection: TypedCollection,
    fileType: BrunoFileType,
    logger?: Logger,
    parsedDocument?: ParsedYamlDocument,
): VariableSectionRequest | undefined {
    const allSections = getVariableScopeSectionsFromYamlFile(
        request.documentHelper,
        fileType,
        parsedDocument,
    );
    const sectionContainingPosition = allSections.find(({ range }) =>
        range.contains(request.position),
    );

    return sectionContainingPosition
        ? {
              request,
              file: { collection, allSections, sectionContainingPosition },
              logger,
          }
        : undefined;
}
