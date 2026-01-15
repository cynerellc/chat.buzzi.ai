/**
 * Background Jobs Module
 *
 * Provides a database-backed job queue for background task processing.
 */

export {
  JobQueue,
  getJobQueue,
  enqueueJob,
  processJobs,
  registerJobHandler,
  type Job,
  type JobStatus,
  type JobPriority,
  type CreateJobInput,
  type JobResult,
  type JobHandler,
} from "./queue";

export {
  JOB_TYPES,
  registerDefaultHandlers,
  type SendEmailPayload,
  type ProcessKnowledgePayload,
  type GenerateReportPayload,
  type CleanupDataPayload,
  type SyncExternalPayload,
  type SendNotificationPayload,
} from "./handlers";
