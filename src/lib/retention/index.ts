/**
 * Data Retention Module
 *
 * Handles data retention policies and GDPR compliance.
 */

export {
  DataRetentionService,
  getDataRetentionService,
  runDataRetention,
  type RetentionPolicy,
  type DataType,
  type RetentionAction,
  type RetentionResult,
  type RetentionSummary,
} from "./data-retention-service";
