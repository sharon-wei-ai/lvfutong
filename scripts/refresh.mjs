import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFeed } from "../src/crawl.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "public", "feed.json");

export async function refreshFeed() {
  const feed = await buildFeed();
  await writeFile(outFile, JSON.stringify(feed, null, 2));
  return feed;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const feed = await refreshFeed();
  const ok = feed.sources.filter((s) => s.status === "ok").length;
  const fail = feed.sources.filter((s) => s.status === "fail").length;
  console.log(
    `refreshed ${feed.itemCount} items · sources ok ${ok} / fail ${fail} / empty ${feed.sources.length - ok - fail}`
  );
  for (const s of feed.sources) {
    console.log(`  ${s.status.padEnd(5)} ${s.sourceId}${s.error ? " · " + s.error : ""}`);
  }
}
