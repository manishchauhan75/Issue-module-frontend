// One entry per issue module. To switch a module on once its API exists,
// set enabled: true — the dashboard, validation page and groups page pick it up.

import {
  validateSchema,
  getSchemaIssueGroups,
  getSchemaFileErrors,
  applyMicroXslt,
  applyMasterXslt,
} from "./api/schemaIssues";
import { validateBrokenLinks, getBrokenLinkGroups, getBrokenLinkFileErrors } from "./api/brokenLinks";
import { validateMissingMetadata, getMissingMetadataGroups } from "./api/missingMetadata";

export const MODULES = [
  {
    key: "schema",
    title: "Schema Issues",
    viewAllLabel: "View All Schema Issues",
    path: "/issues/schema",
    enabled: true,
    validate: validateSchema,
    getGroups: getSchemaIssueGroups,
    // Optional: modules with this get a per-file "View errors" page.
    getFileErrors: getSchemaFileErrors,
    features: { microXslt: true, masterXslt: true },
    fixElement: applyMicroXslt,
    fixAll: applyMasterXslt,
  },
  {
    key: "brokenLinks",
    title: "Broken Links",
    viewAllLabel: "View All Broken Links",
    path: "/issues/broken-links",
    enabled: true,
    validate: validateBrokenLinks,
    getGroups: getBrokenLinkGroups,
    getFileErrors: getBrokenLinkFileErrors,
    // Broken links have no severity: the file view filters and colours them by link type.
    viewBy: "link_type",
    features: {},
  },
  {
    key: "missingMetadata",
    title: "Missing Metadata",
    viewAllLabel: "View All Missing Metadata",
    path: "/issues/missing-metadata",
    enabled: false,
    validate: validateMissingMetadata,
    getGroups: getMissingMetadataGroups,
    features: {},
  },
];

export const moduleByKey = (key) => MODULES.find((m) => m.key === key);
