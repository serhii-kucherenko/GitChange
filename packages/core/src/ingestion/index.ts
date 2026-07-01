export { openRepo, walkFromHead, walkRange, type Repository } from "./git-walk.js";
export { parseCommit } from "./commit-parse.js";
export { diffCommit, type RawFileChange } from "./diff.js";
export {
  DEFAULT_DOC_GLOBS,
  captureDocSnapshots,
  isDocPath,
  type CapturedDoc,
} from "./doc-snapshot.js";
