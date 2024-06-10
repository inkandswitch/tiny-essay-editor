type UrlSource = {
  type: "url";
  url: string;
};

type AutomergeDocSource = {
  type: "automerge";
  "index.js": {
    contentType: "application/javascript";
    contents: string;
  };
};

type ModuleSource = UrlSource | AutomergeDocSource;

export type ModuleDoc = {
  title: string;
  source: ModuleSource;
};
