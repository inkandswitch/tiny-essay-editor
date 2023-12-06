const LAB_USERS = [
  "Geoffrey Litt",
  "Paul Sonnentag",
  "Alexander Obenauer",
  "Peter van Hardenberg",
  "James Lindenbaum",
  "Marcel Goethals",
  "Ivan Reese",
  "Alex Warth",
  "Todd Matthews",
  "Alex Good",
  "Orion Henry",
  "Mary Rose Cook",
].sort();

export function init(doc: any) {
  doc.content = "# Untitled\n\n";
  doc.commentThreads = {};
  doc.users = [];
  for (const name of LAB_USERS) {
    const idStr = name.toLowerCase().replace(" ", "-");
    const user = { id: idStr, name };
    doc.users.push(user);
  }
  doc.forkMetadata = {
    parent: null,
    knownForks: [],
  };
}
