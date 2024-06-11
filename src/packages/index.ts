export const PACKAGES = import.meta.glob("./*/index.@(ts|js|tsx|jsx)", {
  eager: true,
});

console.log(PACKAGES);
