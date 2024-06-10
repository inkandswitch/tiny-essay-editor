type UrlSource = {
  type: "url";
  url: string;
};

type AutomergeDocSource = {
  type: "automerge";
  "index.js": {
    contentType: "text/javascript";
    content: string;
  };
};

type ModuleSource = UrlSource | AutomergeDocSource;

export type ModuleDoc = {
  title: string;
  source: ModuleSource;
};
