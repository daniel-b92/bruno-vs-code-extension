import {
    BrunoFileType,
    CollectionFormat,
    getVariableScopeSectionsFromFile,
    Logger,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../shared";
import { VariableSectionRequest } from "../shared/variables/interfaces";

/** @returns `undefined`, if the position is not within any section that can be handled. */
export function getVariableSectionRequest(
    request: LanguageFeatureBaseRequest,
    collection: TypedCollection,
    fileType: BrunoFileType,
    logger?: Logger,
): VariableSectionRequest | undefined {
    const allSections = getVariableScopeSectionsFromFile(
        request.documentHelper.getText(),
        fileType,
        CollectionFormat.Yaml,
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
