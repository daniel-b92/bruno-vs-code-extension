import * as ts from "typescript/lib/tsserverlibrary";
import { createCheckForPositionsWithinCode } from "../codeBlocks/getCodeRanges";
import { hasEmbeddedCodeBlocks } from "../fileTypes";

// For `.bru` and Yaml files, the Typescript server also sees the wrappers of the code blocks (see `getBlockWrapperCandidates`).
// The wrappers are written in front of the code, so everything that starts outside of the code belongs to them and is not shown.
export function overridePresentation(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    const createCheckForFile = (fileName: string) => {
        const isWithinCode = createCheckForPositionsWithinCode(info);

        return (position: number) => isWithinCode(fileName, position);
    };

    proxy.provideInlayHints = (fileName, span, preferences) => {
        const hints = info.languageService.provideInlayHints(
            fileName,
            span,
            preferences,
        );

        if (!hasEmbeddedCodeBlocks(fileName)) {
            return hints;
        }

        const isWithinCode = createCheckForFile(fileName);

        return hints.filter(({ position }) => isWithinCode(position));
    };

    const filterClassifications = (
        fileName: string,
        classifications: ts.Classifications,
    ): ts.Classifications => {
        if (!hasEmbeddedCodeBlocks(fileName)) {
            return classifications;
        }

        const isWithinCode = createCheckForFile(fileName);
        const spans: number[] = [];

        // The spans are encoded as triples of start, length and classification.
        for (let i = 0; i < classifications.spans.length; i += 3) {
            if (isWithinCode(classifications.spans[i])) {
                spans.push(...classifications.spans.slice(i, i + 3));
            }
        }

        return { ...classifications, spans };
    };

    proxy.getEncodedSemanticClassifications = (fileName, span, format) =>
        filterClassifications(
            fileName,
            info.languageService.getEncodedSemanticClassifications(
                fileName,
                span,
                format,
            ),
        );

    proxy.getEncodedSyntacticClassifications = (fileName, span) =>
        filterClassifications(
            fileName,
            info.languageService.getEncodedSyntacticClassifications(
                fileName,
                span,
            ),
        );

    proxy.getNavigationTree = (fileName) => {
        const tree = info.languageService.getNavigationTree(fileName);

        if (!hasEmbeddedCodeBlocks(fileName)) {
            return tree;
        }

        const isWithinCode = createCheckForFile(fileName);
        const removeWrappers = (
            items: ts.NavigationTree[] | undefined,
        ): ts.NavigationTree[] | undefined =>
            items?.flatMap((item) =>
                isWithinCode(item.spans[0].start)
                    ? [{ ...item, childItems: removeWrappers(item.childItems) }]
                    : (removeWrappers(item.childItems) ?? []),
            );

        // The root item spans the whole file, including the content outside of the code.
        return { ...tree, childItems: removeWrappers(tree.childItems) };
    };

    proxy.getNavigationBarItems = (fileName) => {
        const items = info.languageService.getNavigationBarItems(fileName);

        if (!hasEmbeddedCodeBlocks(fileName)) {
            return items;
        }

        const isWithinCode = createCheckForFile(fileName);
        const isWrapper = ({ spans }: ts.NavigationBarItem) =>
            !isWithinCode(spans[0].start);

        // Unlike the navigation tree, the navigation bar lists every item with children separately on the top level.
        // The wrappers are only children of the root item that spans the whole file, so the children of the wrappers are moved to it.
        const [root, ...otherItems] = items;

        return root
            ? [
                  {
                      ...root,
                      childItems: [
                          ...root.childItems.filter((item) => !isWrapper(item)),
                          ...otherItems
                              .filter(isWrapper)
                              .flatMap(({ childItems }) => childItems),
                      ],
                  },
                  ...otherItems.filter((item) => !isWrapper(item)),
              ]
            : items;
    };

    proxy.getOutliningSpans = (fileName) => {
        const spans = info.languageService.getOutliningSpans(fileName);

        if (!hasEmbeddedCodeBlocks(fileName)) {
            return spans;
        }

        const isWithinCode = createCheckForFile(fileName);

        return spans.filter(({ textSpan }) => isWithinCode(textSpan.start));
    };

    proxy.getSmartSelectionRange = (fileName, position) => {
        const selectionRange = info.languageService.getSmartSelectionRange(
            fileName,
            position,
        );

        if (!hasEmbeddedCodeBlocks(fileName)) {
            return selectionRange;
        }

        const isWithinCode = createCheckForFile(fileName);
        const rangesWithinCode: ts.TextSpan[] = [];

        // The ranges are ordered from the innermost to the outermost one, so all ranges behind the first one outside of the code are outside of it as well.
        for (
            let range: ts.SelectionRange | undefined = selectionRange;
            range != undefined &&
            isWithinCode(range.textSpan.start) &&
            isWithinCode(ts.textSpanEnd(range.textSpan));
            range = range.parent
        ) {
            rangesWithinCode.push(range.textSpan);
        }

        return (
            rangesWithinCode.reduceRight<ts.SelectionRange | undefined>(
                (parent, textSpan) => ({ textSpan, parent }),
                undefined,
            ) ?? { textSpan: { start: position, length: 0 } }
        );
    };
}
