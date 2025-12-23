/**
 * Data Retention Service
 *
 * Handles data retention policies for GDPR compliance and data hygiene:
 * - Conversation data cleanup
 * - Message archival and deletion
 * - Customer PII anonymization
 * - Audit log retention
 * - Analytics data aggregation
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Types
export interface RetentionPolicy {
  id: string;
  companyId: string | null; // null = system-wide policy
  name: string;
  dataType: DataType;
  retentionDays: number;
  action: RetentionAction;
  isEnabled: boolean;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type DataType =
  | "conversations"
  | "messages"
  | "customer_data"
  | "audit_logs"
  | "analytics"
  | "attachments"
  | "usage_records";

export type RetentionAction = "delete" | "anonymize" | "archive";

export interface RetentionResult {
  policyId: string;
  dataType: DataType;
  action: RetentionAction;
  recordsProcessed: number;
  recordsAffected: number;
  errors: string[];
  executionTimeMs: number;
}

export interface RetentionSummary {
  totalPoliciesExecuted: number;
  totalRecordsProcessed: number;
  totalRecordsAffected: number;
  results: RetentionResult[];
  executedAt: Date;
}

// Default retention policies (in days)
const DEFAULT_RETENTION_DAYS: Record<DataType, number> = {
  conversations: 365, // 1 year
  messages: 365,
  customer_data: 730, // 2 years
  audit_logs: 2555, // 7 years (compliance)
  analytics: 365,
  attachments: 180, // 6 months
  usage_records: 365,
};

/**
 * Data Retention Service
 */
export class DataRetentionService {
  /**
   * Get all retention policies for a company
   */
  async getPolicies(companyId?: string): Promise<RetentionPolicy[]> {
    const result = await db.execute<{
      id: string;
      company_id: string | null;
      name: string;
      data_type: DataType;
      retention_days: number;
      action: RetentionAction;
      is_enabled: boolean;
      last_executed_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      SELECT * FROM chatapp_retention_policies
      WHERE company_id = ${companyId ?? null} OR company_id IS NULL
      ORDER BY data_type, company_id NULLS LAST
    `);

    return result.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      dataType: row.data_type,
      retentionDays: row.retention_days,
      action: row.action,
      isEnabled: row.is_enabled,
      lastExecutedAt: row.last_executed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Create or update a retention policy
   */
  async upsertPolicy(
    policy: Omit<RetentionPolicy, "id" | "createdAt" | "updatedAt" | "lastExecutedAt">
  ): Promise<RetentionPolicy> {
    const now = new Date();

    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO chatapp_retention_policies
      (id, company_id, name, data_type, retention_days, action, is_enabled, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${policy.companyId},
        ${policy.name},
        ${policy.dataType},
        ${policy.retentionDays},
        ${policy.action},
        ${policy.isEnabled},
        ${now},
        ${now}
      )
      ON CONFLICT (company_id, data_type) DO UPDATE SET
        name = EXCLUDED.name,
        retention_days = EXCLUDED.retention_days,
        action = EXCLUDED.action,
        is_enabled = EXCLUDED.is_enabled,
        updated_at = ${now}
      RETURNING id
    `);

    return {
      id: result[0]!.id,
      ...policy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Execute a single retention policy
   */
  async executePolicy(policy: RetentionPolicy): Promise<RetentionResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    let recordsProcessed = 0;
    let recordsAffected = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    try {
      switch (policy.dataType) {
        case "conversations":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processConversations(policy, cutoffDate));
          break;
        case "messages":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processMessages(policy, cutoffDate));
          break;
        case "customer_data":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processCustomerData(policy, cutoffDate));
          break;
        case "audit_logs":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processAuditLogs(policy, cutoffDate));
          break;
        case "analytics":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processAnalytics(policy, cutoffDate));
          break;
        case "attachments":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processAttachments(policy, cutoffDate));
          break;
        case "usage_records":
          ({ processed: recordsProcessed, affected: recordsAffected } =
            await this.processUsageRecords(policy, cutoffDate));
          break;
      }

      // Update last executed timestamp
      await db.execute(sql`
        UPDATE chatapp_retention_policies
        SET last_executed_at = NOW(), updated_at = NOW()
        WHERE id = ${policy.id}
      `);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return {
      policyId: policy.id,
      dataType: policy.dataType,
      action: policy.action,
      recordsProcessed,
      recordsAffected,
      errors,
      executionTimeMs: performance.now() - startTime,
    };
  }

  /**
   * Execute all enabled retention policies
   */
  async executeAllPolicies(companyId?: string): Promise<RetentionSummary> {
    const policies = await this.getPolicies(companyId);
    const enabledPolicies = policies.filter((p) => p.isEnabled);

    const results: RetentionResult[] = [];

    for (const policy of enabledPolicies) {
      const result = await this.executePolicy(policy);
      results.push(result);
    }

    return {
      totalPoliciesExecuted: results.length,
      totalRecordsProcessed: results.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalRecordsAffected: results.reduce((sum, r) => sum + r.recordsAffected, 0),
      results,
      executedAt: new Date(),
    };
  }

  /**
   * Process conversation retention
   */
  private async processConversations(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    const whereClause = policy.companyId
      ? `company_id = '${policy.companyId}' AND`
      : "";

    if (policy.action === "delete") {
      const result = await db.execute<{ count: number }>(sql`
        WITH deleted AS (
          DELETE FROM chatapp_conversations
          WHERE ${sql.raw(whereClause)} created_at < ${cutoffDate}
            AND status = 'resolved'
          RETURNING id
        )
        SELECT COUNT(*) as count FROM deleted
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    if (policy.action === "anonymize") {
      const result = await db.execute<{ count: number }>(sql`
        WITH updated AS (
          UPDATE chatapp_conversations
          SET
            customer_email = CONCAT('anonymized_', id, '@deleted.local'),
            customer_name = 'Anonymized User',
            metadata = '{}'::jsonb,
            updated_at = NOW()
          WHERE ${sql.raw(whereClause)} created_at < ${cutoffDate}
            AND customer_email NOT LIKE '%@deleted.local'
          RETURNING id
        )
        SELECT COUNT(*) as count FROM updated
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Process message retention
   */
  private async processMessages(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    const whereClause = policy.companyId
      ? `c.company_id = '${policy.companyId}' AND`
      : "";

    if (policy.action === "delete") {
      const result = await db.execute<{ count: number }>(sql`
        WITH deleted AS (
          DELETE FROM chatapp_messages m
          USING chatapp_conversations c
          WHERE m.conversation_id = c.id
            AND ${sql.raw(whereClause)} m.created_at < ${cutoffDate}
          RETURNING m.id
        )
        SELECT COUNT(*) as count FROM deleted
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    if (policy.action === "anonymize") {
      const result = await db.execute<{ count: number }>(sql`
        WITH updated AS (
          UPDATE chatapp_messages m
          SET
            content = '[Content removed per retention policy]',
            updated_at = NOW()
          FROM chatapp_conversations c
          WHERE m.conversation_id = c.id
            AND ${sql.raw(whereClause)} m.created_at < ${cutoffDate}
            AND m.content != '[Content removed per retention policy]'
          RETURNING m.id
        )
        SELECT COUNT(*) as count FROM updated
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Process customer data retention (GDPR)
   */
  private async processCustomerData(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    const whereClause = policy.companyId
      ? `company_id = '${policy.companyId}' AND`
      : "";

    if (policy.action === "anonymize") {
      const result = await db.execute<{ count: number }>(sql`
        WITH updated AS (
          UPDATE chatapp_customers
          SET
            email = CONCAT('gdpr_', id, '@anonymized.local'),
            name = 'GDPR Anonymized',
            phone = NULL,
            metadata = '{}'::jsonb,
            updated_at = NOW()
          WHERE ${sql.raw(whereClause)} last_seen_at < ${cutoffDate}
            AND email NOT LIKE '%@anonymized.local'
          RETURNING id
        )
        SELECT COUNT(*) as count FROM updated
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Process audit log retention
   */
  private async processAuditLogs(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    if (policy.action === "delete") {
      const result = await db.execute<{ count: number }>(sql`
        WITH deleted AS (
          DELETE FROM chatapp_audit_logs
          WHERE created_at < ${cutoffDate}
          RETURNING id
        )
        SELECT COUNT(*) as count FROM deleted
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Process analytics data retention (aggregate then delete)
   */
  private async processAnalytics(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    const whereClause = policy.companyId
      ? `company_id = '${policy.companyId}' AND`
      : "";

    if (policy.action === "delete" || policy.action === "archive") {
      // First, aggregate hourly into daily (if not already)
      await db.execute(sql`
        INSERT INTO chatapp_daily_analytics
        (id, company_id, agent_id, date, conversations_count, messages_count,
         avg_response_time, resolution_rate, satisfaction_score, created_at)
        SELECT
          gen_random_uuid(),
          company_id,
          agent_id,
          DATE(date),
          SUM(conversations_count),
          SUM(messages_count),
          AVG(avg_response_time),
          AVG(resolution_rate),
          AVG(satisfaction_score),
          NOW()
        FROM chatapp_hourly_analytics
        WHERE ${sql.raw(whereClause)} date < ${cutoffDate}
        GROUP BY company_id, agent_id, DATE(date)
        ON CONFLICT (company_id, agent_id, date) DO NOTHING
      `);

      // Then delete the hourly data
      const result = await db.execute<{ count: number }>(sql`
        WITH deleted AS (
          DELETE FROM chatapp_hourly_analytics
          WHERE ${sql.raw(whereClause)} date < ${cutoffDate}
          RETURNING id
        )
        SELECT COUNT(*) as count FROM deleted
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Process attachment retention
   */
  private async processAttachments(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    const whereClause = policy.companyId
      ? `c.company_id = '${policy.companyId}' AND`
      : "";

    if (policy.action === "delete") {
      // Get attachments to delete (for file system cleanup)
      const attachments = await db.execute<{ id: string; file_path: string }>(sql`
        SELECT a.id, a.file_path
        FROM chatapp_attachments a
        JOIN chatapp_messages m ON a.message_id = m.id
        JOIN chatapp_conversations c ON m.conversation_id = c.id
        WHERE ${sql.raw(whereClause)} a.created_at < ${cutoffDate}
      `);

      // TODO: Delete files from storage (S3, etc.)
      // for (const attachment of attachments) {
      //   await deleteFile(attachment.file_path);
      // }

      // Delete from database
      const result = await db.execute<{ count: number }>(sql`
        WITH deleted AS (
          DELETE FROM chatapp_attachments a
          USING chatapp_messages m, chatapp_conversations c
          WHERE a.message_id = m.id
            AND m.conversation_id = c.id
            AND ${sql.raw(whereClause)} a.created_at < ${cutoffDate}
          RETURNING a.id
        )
        SELECT COUNT(*) as count FROM deleted
      `);
      return { processed: attachments.length, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Process usage records retention
   */
  private async processUsageRecords(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ processed: number; affected: number }> {
    const whereClause = policy.companyId
      ? `company_id = '${policy.companyId}' AND`
      : "";

    if (policy.action === "delete") {
      const result = await db.execute<{ count: number }>(sql`
        WITH deleted AS (
          DELETE FROM chatapp_usage_records
          WHERE ${sql.raw(whereClause)} recorded_at < ${cutoffDate}
          RETURNING id
        )
        SELECT COUNT(*) as count FROM deleted
      `);
      return { processed: result[0]?.count || 0, affected: result[0]?.count || 0 };
    }

    return { processed: 0, affected: 0 };
  }

  /**
   * Get default retention days for a data type
   */
  getDefaultRetentionDays(dataType: DataType): number {
    return DEFAULT_RETENTION_DAYS[dataType];
  }
}

// Singleton instance
let serviceInstance: DataRetentionService | null = null;

export function getDataRetentionService(): DataRetentionService {
  if (!serviceInstance) {
    serviceInstance = new DataRetentionService();
  }
  return serviceInstance;
}

// Convenience function for cron jobs
export async function runDataRetention(companyId?: string): Promise<RetentionSummary> {
  return getDataRetentionService().executeAllPolicies(companyId);
}
