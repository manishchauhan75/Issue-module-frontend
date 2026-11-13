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
import {
  validateMissingMetadata,
  getMissingMetadataGroups,
  getMissingMetadataFileErrors,
} from "./api/missingMetadata";

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
    // The file view filters broken links by link type; keyrefs are warnings, the rest errors.
    viewBy: "link_type",
    // The groups page filters by link type from a list instead of a typed element name,
    // with a count card per type from the groups response's countsField.
    filter: {
      label: "Link type",
      countsField: "broken_links",
      totalLabel: "Total Broken Links",
      options: [
        ["image", "Images"],
        ["external", "External"],
        ["cross_reference", "Cross-references"],
        ["keyref", "Keyrefs"],
        ["conref", "Conrefs"],
      ],
    },
    features: {},
  },
  {
    key: "missingMetadata",
    title: "Missing Metadata",
    viewAllLabel: "View All Missing Metadata",
    path: "/issues/missing-metadata",
    enabled: true,
    validate: validateMissingMetadata,
    getGroups: getMissingMetadataGroups,
    getFileErrors: getMissingMetadataFileErrors,
    // Empty tags are warnings, missing ones info; never errors.
    filter: {
      label: "Metadata",
      countsField: "missing_metadata",
      totalLabel: "Total Missing Metadata",
      // 21 items: only the ones with findings get a card.
      hideEmptyCards: true,
      // [key, label, depth]: tree order, depth = nesting (prolog > critdates > created).
      options: [
        ["shortdesc", "Short description", 0],
        ["xml_lang", "XML language", 0],
        ["prolog", "Prolog", 0],
        ["author", "Author", 1],
        ["critdates", "Critical dates", 1],
        ["created", "Creation date", 2],
        ["revised", "Revision date", 2],
        ["permissions", "Permissions", 1],
        ["metadata", "Metadata block", 1],
        ["audience", "Audience", 2],
        ["category", "Category", 2],
        ["keywords", "Keywords", 2],
        ["indexterm", "Index terms", 3],
        ["prodinfo", "Product information", 2],
        ["prodname", "Product name", 3],
        ["version", "Version number", 3],
        ["component", "Component", 3],
        ["platform", "Platform", 3],
        ["resourceid", "Resource ID", 1],
        ["appname", "Resource ID app name", 2],
        ["appid", "Resource ID value", 2],
      ],
    },
    features: {},
  },
];

export const moduleByKey = (key) => MODULES.find((m) => m.key === key);
