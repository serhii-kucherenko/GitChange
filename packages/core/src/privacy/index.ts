export { DEFAULT_GITCHANGEIGNORE } from "./default-gitchangeignore.js";
export {
  createIgnoreMatcher,
  loadIgnore,
  type IgnoreMatcher,
} from "./gitchangeignore.js";
export {
  applyPrivacy,
  redact,
  SECRET_RULES,
  type SecretFinding,
} from "./redaction.js";
