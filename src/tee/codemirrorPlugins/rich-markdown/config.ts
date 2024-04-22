import markdoc from "@markdoc/markdoc";
import type { Config } from "@markdoc/markdoc";

markdoc.transformer.findSchema = (node, config) => {
  return node.tag
    ? config?.tags?.[node.tag] ?? config?.tags?.$$fallback
    : config?.nodes?.[node.type];
};

export const config = {
  tags: {
    $$fallback: {
      transform(node, config) {
        const children = node.transformChildren(config);
        const className = "cm-markdoc-fallbackTag";
        return new markdoc.Tag("div", { class: className }, [
          new markdoc.Tag("div", { class: `${className}--name` }, [
            node?.tag ?? "",
          ]),
          new markdoc.Tag("div", { class: `${className}--inner` }, children),
        ]);
      },
    },
    callout: {
      transform(node, config) {
        const children = node.transformChildren(config);
        const kind = node.attributes.type === "warning" ? "warning" : "info";
        const icon = kind === "warning" ? "icon-exclamation" : "icon-info";
        const className = `cm-markdoc-callout cm-markdoc-callout--${kind}`;
        return new markdoc.Tag("div", { class: className }, [
          new markdoc.Tag("span", { class: `icon ${icon}` }),
          new markdoc.Tag("div", {}, children),
        ]);
      },
    },
  },
} as Config;
