/**
 * Background Job Queue
 *
 * A simple database-backed job queue for handling background tasks:
 * - Email sending
 * - Data processing
 * - Webhook delivery
 * - Report generation
 * - Cleanup tasks
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Types
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type JobPriority = "low" | "normal" | "high" | "critical";

export interface Job<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobInput<T = Record<string, unknown>> {
  type: string;
  payload: T;
  priority?: JobPriority;
  maxAttempts?: number;
  scheduledAt?: Date;
}

export interface JobResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export type JobHandler<T = Record<string, unknown>> = (job: Job<T>) => Promise<JobResult>;

/**
 * Job Queue Service
 */
export class JobQueue {
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;
  private processingJobId: string | null = null;

  /**
   * Register a job handler
   */
  registerHandler<T = Record<string, unknown>>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Enqueue a new job
   */
  async enqueue<T = Record<string, unknown>>(input: CreateJobInput<T>): Promise<Job<T>> {
    const now = new Date();

    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO chatapp_jobs
      (id, type, payload, status, priority, attempts, max_attempts, scheduled_at, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${input.type},
        ${JSON.stringify(input.payload)}::jsonb,
        'pending',
        ${input.priority ?? "normal"},
        0,
        ${input.maxAttempts ?? 3},
        ${input.scheduledAt ?? now},
        ${now},
        ${now}
      )
      RETURNING id
    `);

    return {
      id: result[0]!.id,
      type: input.type,
      payload: input.payload as T,
      status: "pending",
      priority: input.priority ?? "normal",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      scheduledAt: input.scheduledAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Enqueue multiple jobs at once
   */
  async enqueueBatch<T = Record<string, unknown>>(jobs: CreateJobInput<T>[]): Promise<Job<T>[]> {
    const results: Job<T>[] = [];
    for (const job of jobs) {
      results.push(await this.enqueue(job));
    }
    return results;
  }

  /**
   * Get the next job to process
   */
  async getNextJob(): Promise<Job | null> {
    // Get the next pending job that's scheduled to run, ordered by priority and scheduled time
    const result = await db.execute<{
      id: string;
      type: string;
      payload: Record<string, unknown>;
      status: JobStatus;
      priority: JobPriority;
      attempts: number;
      max_attempts: number;
      last_error: string | null;
      scheduled_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      UPDATE chatapp_jobs
      SET status = 'processing', started_at = NOW(), attempts = attempts + 1, updated_at = NOW()
      WHERE id = (
        SELECT id FROM chatapp_jobs
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 1
          END DESC,
          scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (result.length === 0) return null;

    const row = result[0]!;
    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      status: "processing" as JobStatus,
      priority: row.priority,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastError: row.last_error ?? undefined,
      scheduledAt: row.scheduled_at,
      startedAt: new Date(),
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: new Date(),
    };
  }

  /**
   * Mark a job as completed
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async completeJob(jobId: string, _result?: unknown): Promise<void> {
    await db.execute(sql`
      UPDATE chatapp_jobs
      SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${jobId}
    `);
  }

  /**
   * Mark a job as failed
   */
  async failJob(jobId: string, error: string): Promise<void> {
    // Check if we should retry
    const job = await db.execute<{ attempts: number; max_attempts: number }>(sql`
      SELECT attempts, max_attempts FROM chatapp_jobs WHERE id = ${jobId}
    `);

    if (job.length === 0) return;

    const { attempts, max_attempts } = job[0]!;
    const newStatus: JobStatus = attempts >= max_attempts ? "failed" : "pending";

    // Exponential backoff for retry
    const backoffMinutes = Math.min(Math.pow(2, attempts), 60);
    const nextScheduledAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await db.execute(sql`
      UPDATE chatapp_jobs
      SET
        status = ${newStatus},
        last_error = ${error},
        scheduled_at = CASE WHEN ${newStatus} = 'pending' THEN ${nextScheduledAt} ELSE scheduled_at END,
        updated_at = NOW()
      WHERE id = ${jobId}
    `);
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const result = await db.execute<{ id: string }>(sql`
      UPDATE chatapp_jobs
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${jobId} AND status = 'pending'
      RETURNING id
    `);

    return result.length > 0;
  }

  /**
   * Process a single job
   */
  async processJob(job: Job): Promise<JobResult> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      const error = `No handler registered for job type: ${job.type}`;
      await this.failJob(job.id, error);
      return { success: false, error };
    }

    try {
      const result = await handler(job);

      if (result.success) {
        await this.completeJob(job.id, result.data);
      } else {
        await this.failJob(job.id, result.error ?? "Unknown error");
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await this.failJob(job.id, error);
      return { success: false, error };
    }
  }

  /**
   * Process all pending jobs
   */
  async processAll(options?: { limit?: number; concurrency?: number }): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const limit = options?.limit ?? 100;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (processed < limit) {
      const job = await this.getNextJob();
      if (!job) break;

      const result = await this.processJob(job);
      processed++;

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { processed, succeeded, failed };
  }

  /**
   * Start continuous processing
   */
  async startProcessing(options?: { pollInterval?: number }): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    const pollInterval = options?.pollInterval ?? 1000;

    while (this.isProcessing) {
      const job = await this.getNextJob();

      if (job) {
        this.processingJobId = job.id;
        await this.processJob(job);
        this.processingJobId = null;
      } else {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }
  }

  /**
   * Stop continuous processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const result = await db.execute<{ status: JobStatus; count: number }>(sql`
      SELECT status, COUNT(*)::int as count
      FROM chatapp_jobs
      GROUP BY status
    `);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of result) {
      stats[row.status] = row.count;
    }

    return stats;
  }

  /**
   * Get recent jobs
   */
  async getRecentJobs(options?: {
    status?: JobStatus;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = sql`
      SELECT * FROM chatapp_jobs
      WHERE 1=1
    `;

    if (options?.status) {
      query = sql`${query} AND status = ${options.status}`;
    }

    if (options?.type) {
      query = sql`${query} AND type = ${options.type}`;
    }

    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await db.execute<{
      id: string;
      type: string;
      payload: Record<string, unknown>;
      status: JobStatus;
      priority: JobPriority;
      attempts: number;
      max_attempts: number;
      last_error: string | null;
      scheduled_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(query);

    return result.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      status: row.status,
      priority: row.priority,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastError: row.last_error ?? undefined,
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(options?: { olderThanDays?: number }): Promise<number> {
    const olderThanDays = options?.olderThanDays ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.execute<{ count: number }>(sql`
      WITH deleted AS (
        DELETE FROM chatapp_jobs
        WHERE status IN ('completed', 'failed', 'cancelled')
          AND updated_at < ${cutoffDate}
        RETURNING id
      )
      SELECT COUNT(*)::int as count FROM deleted
    `);

    return result[0]?.count ?? 0;
  }

  /**
   * Retry all failed jobs
   */
  async retryFailed(): Promise<number> {
    const result = await db.execute<{ count: number }>(sql`
      WITH updated AS (
        UPDATE chatapp_jobs
        SET
          status = 'pending',
          attempts = 0,
          last_error = NULL,
          scheduled_at = NOW(),
          updated_at = NOW()
        WHERE status = 'failed'
        RETURNING id
      )
      SELECT COUNT(*)::int as count FROM updated
    `);

    return result[0]?.count ?? 0;
  }
}

// Singleton instance
let queueInstance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!queueInstance) {
    queueInstance = new JobQueue();
  }
  return queueInstance;
}

// Convenience functions
export async function enqueueJob<T = Record<string, unknown>>(
  input: CreateJobInput<T>
): Promise<Job<T>> {
  return getJobQueue().enqueue(input);
}

export async function processJobs(options?: {
  limit?: number;
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  return getJobQueue().processAll(options);
}

export function registerJobHandler<T = Record<string, unknown>>(
  type: string,
  handler: JobHandler<T>
): void {
  getJobQueue().registerHandler(type, handler);
}
