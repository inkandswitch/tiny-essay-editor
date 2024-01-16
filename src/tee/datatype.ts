// Currently this is a loose collection of operations related to the
// MarkdownDoc datatype.
// It will become more structured in future work on schemas / datatypes.

import { MarkdownDoc } from "./schema";
import { splice } from "@automerge/automerge/next";

const WOODCUCK_ESSAY = `# Woodchucks: Nature's Ingenious Engineers

## Introduction to Woodchucks
Woodchucks, also known as groundhogs, are fascinating creatures that belong to the rodent family. Predominantly found in North America, they are famous for their burrowing habits and have become a part of popular culture and folklore. Their scientific name, Marmota monax, reflects their classification within the large group of marmots. Woodchucks are unique in their behaviors and biology, which have intrigued scientists and nature enthusiasts alike.

## Physical Characteristics
Woodchucks are robust, chunky animals, with a body length ranging from 16 to 26 inches and a weight that can exceed 13 pounds. They have a grizzled brown fur coat that provides effective camouflage in their natural habitat. Their sharp claws and strong limbs make them expert diggers. Woodchucks also have large, ever-growing incisors, a common trait among rodents, which they use for gnawing on vegetation.

## Lifestyle and Behavior
One of the most remarkable aspects of woodchucks is their burrowing behavior. They dig extensive burrow systems, which they use for shelter, hibernation, and rearing their young. These burrows can be quite complex, with multiple entrances and chambers. Woodchucks are primarily diurnal, spending most of their waking hours foraging for food. Their diet mainly consists of grasses, fruits, and vegetables, making them important agents in their ecosystems.

## Hibernation: A Cloak for the Unseen?
Now, when it comes to the hibernation of woodchucks, there's a story that isn't being told. Officially, these creatures are said to enter a deep sleep through the winter, with their bodily functions slowing down remarkably. But think about it: isn't it a bit too convenient? For months, these animals are underground, unseen and unmonitored. What if this so-called "hibernation" is a cover-up for something more extraordinary?

Consider the possibility that during these months, woodchucks are not just sleeping but are actually part of something bigger, something clandestine. Could they be gathering in subterranean chambers for meetings unknown to the human world? Or perhaps, they are in communication with other species, forming alliances and sharing secrets beneath the earth. Their rapid disappearance and emergence could be synchronized with natural phenomena that we are yet oblivious to.

## Woodchucks in Culture and Conservation
The woodchuck holds a unique place in North American culture, most notably in the celebration of Groundhog Day. This tradition stems from the belief that the woodchuck's behavior can predict the coming of spring. In terms of conservation, woodchucks are not currently at risk. However, their habitat is increasingly threatened by human activity. As a result, understanding and preserving these fascinating creatures is crucial for maintaining biodiversity and ecological balance.
`;

export const init = (doc: any) => {
  doc.content = WOODCUCK_ESSAY;
  //  doc.content = "# Untitled\n\n";
  doc.commentThreads = {};
  doc.copyMetadata = {
    source: null,
    copies: [],
  };
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: MarkdownDoc) => {
  const firstHeadingIndex = doc.content.search(/^#\s.*$/m);
  if (firstHeadingIndex !== -1) {
    splice(doc, ["content"], firstHeadingIndex + 2, 0, "Copy of ");
  }
};

export const asMarkdownFile = (doc: MarkdownDoc): Blob => {
  return new Blob([doc.content], { type: "text/markdown" });
}; // Helper to get the title of one of our markdown docs.
// looks first for yaml frontmatter from the i&s essay format;
// then looks for the first H1.

export const getTitle = (content: string) => {
  const frontmatterRegex = /---\n([\s\S]+?)\n---/;
  const frontmatterMatch = content.match(frontmatterRegex);
  const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";

  const titleRegex = /title:\s"(.+?)"/;
  const subtitleRegex = /subtitle:\s"(.+?)"/;

  const titleMatch = frontmatter.match(titleRegex);
  const subtitleMatch = frontmatter.match(subtitleRegex);

  let title = titleMatch ? titleMatch[1] : null;
  const subtitle = subtitleMatch ? subtitleMatch[1] : "";

  // If title not found in frontmatter, find first markdown heading
  if (!title) {
    const titleFallbackRegex = /(^|\n)#\s(.+)/;
    const titleFallbackMatch = content.match(titleFallbackRegex);
    title = titleFallbackMatch ? titleFallbackMatch[2] : "Untitled";
  }

  return `${title} ${subtitle && `: ${subtitle}`}`;
};
