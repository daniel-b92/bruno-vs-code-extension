import {
    BrunoFileType,
    getYamlKeyInfoAtPosition,
    isBrunoFileType,
    isCodeSection,
    parseRequestFile,
    parseYamlDocument,
} from "@global_shared";
import { Document } from "yaml";
import { Hover } from "vscode-languageserver";
import {
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
} from "../../shared";
import { getHoverForExistingTag } from "../../shared/getHoverForExistingTag";
import { getHoverForVariableInCodeSection } from "../../shared/variables/getHoverForVariableInCodeSection";
import { getHoverForVariableInNonCodeSection } from "../../shared/variables/getHoverForVariableInNonCodeSection";
import { getHoverForYamlKey } from "./getHoverForYamlKey";
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

    const parsed = parseYamlDocument(documentHelper.getText());
    const itemType = getYamlFileTypeForEditorContent(
        cachedItemType,
        documentHelper.getText(),
        parsed.document,
    );

    if (itemType == BrunoFileType.RequestFile) {
        const tagHover = getHoverForTag(
            {
                baseRequest,
                itemProvider,
                collection,
            },
            parsed.document,
        );
        if (tagHover) {
            return tagHover;
        }
    }

    const variableRequest = getVariableSectionRequest(
        baseRequest,
        collection,
        itemType,
        logger,
        parsed,
    );

    const variableHover = variableRequest
        ? isCodeSection(variableRequest.file.sectionContainingPosition.kind)
            ? getHoverForVariableInCodeSection(
                  variableRequest,
                  configuredEnvironmentName,
              )
            : getHoverForVariableInNonCodeSection(
                  variableRequest,
                  configuredEnvironmentName,
              )
        : undefined;

    return (
        variableHover ?? getHoverForKey(baseRequest, itemType, parsed.document)
    );
}

function getHoverForKey(
    { documentHelper, position }: LanguageFeatureBaseRequest,
    fileType: BrunoFileType,
    parsedDocument: Document,
) {
    const keyAtPosition = getYamlKeyInfoAtPosition({
        docHelper: documentHelper,
        fileType,
        position,
        parsedDocument,
    });

    return keyAtPosition
        ? getHoverForYamlKey(keyAtPosition.keyInfo, keyAtPosition.keyRange)
        : undefined;
}

function getHoverForTag(
    {
        baseRequest: { documentHelper, filePath, position },
        itemProvider,
        collection,
    }: Pick<
        LanguageRequestWithTestEnvironmentInfo,
        "baseRequest" | "itemProvider" | "collection"
    >,
    parsedDocument: Document,
) {
    const tags =
        parseRequestFile(documentHelper, {
            continueOnSyntaxErrors: true,
            parsedDocument,
        }).result?.properties.info?.properties.tags?.value ?? [];
    const tagAtPosition = tags.find(({ range }) => range.contains(position));

    if (!tagAtPosition) {
        return undefined;
    }

    return getHoverForExistingTag(
        tagAtPosition.value,
        filePath,
        documentHelper,
        {
            itemProvider,
            collection,
        },
    );
}
