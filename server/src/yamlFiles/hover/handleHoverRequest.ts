import {
    BrunoFileType,
    isBrunoFileType,
    isCodeSection,
    parseRequestFile,
} from "@global_shared";
import { Hover } from "vscode-languageserver";
import { LanguageRequestWithTestEnvironmentInfo } from "../../shared";
import { getHoverForExistingTag } from "../../shared/getHoverForExistingTag";
import { getHoverForVariableInCodeSection } from "../../shared/variables/getHoverForVariableInCodeSection";
import { getHoverForVariableInNonCodeSection } from "../../shared/variables/getHoverForVariableInNonCodeSection";
import { getYamlFileTypeForEditorContent } from "../getYamlFileTypeForEditorContent";
import { getVariableSectionRequest } from "../getVariableSectionRequest";

export function handleHoverRequest({
    baseRequest,
    itemProvider,
    collection,
    configuredEnvironmentName,
    logger,
}: LanguageRequestWithTestEnvironmentInfo): Hover | undefined {
    const { documentHelper, filePath } = baseRequest;
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

    if (itemType == BrunoFileType.RequestFile) {
        const tagHover = getHoverForTag({
            baseRequest,
            itemProvider,
            collection,
        });
        if (tagHover) {
            return tagHover;
        }
    }

    const variableRequest = getVariableSectionRequest(
        baseRequest,
        collection,
        itemType,
        logger,
    );

    if (!variableRequest) {
        return undefined;
    }

    return isCodeSection(variableRequest.file.sectionContainingPosition.kind)
        ? getHoverForVariableInCodeSection(
              variableRequest,
              configuredEnvironmentName,
          )
        : getHoverForVariableInNonCodeSection(
              variableRequest,
              configuredEnvironmentName,
          );
}

function getHoverForTag({
    baseRequest: { documentHelper, filePath, position },
    itemProvider,
    collection,
}: Pick<
    LanguageRequestWithTestEnvironmentInfo,
    "baseRequest" | "itemProvider" | "collection"
>) {
    const tags =
        parseRequestFile(documentHelper, { continueOnSyntaxErrors: true })
            .result?.properties.info?.properties.tags?.value ?? [];
    const tagAtPosition = tags.find(({ range }) => range.contains(position));

    if (!tagAtPosition) {
        return undefined;
    }

    return getHoverForExistingTag(tagAtPosition.value, filePath, documentHelper, {
        itemProvider,
        collection,
    });
}
