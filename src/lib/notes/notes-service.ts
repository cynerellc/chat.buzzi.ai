/**
 * Internal Notes Service
 *
 * Manages internal notes for conversations that are only visible
 * to support agents and admins, not to customers.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Types
export type NoteType = "general" | "escalation" | "follow_up" | "resolution" | "warning";

export interface InternalNote {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  companyId: string;
  type: NoteType;
  content: string;
  isPinned: boolean;
  mentions: string[]; // User IDs mentioned in the note
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteInput {
  conversationId: string;
  agentId: string;
  companyId: string;
  type?: NoteType;
  content: string;
  isPinned?: boolean;
  mentions?: string[];
}

export interface UpdateNoteInput {
  type?: NoteType;
  content?: string;
  isPinned?: boolean;
  mentions?: string[];
}

/**
 * Internal Notes Service Class
 */
export class NotesService {
  /**
   * Create a new internal note
   */
  async create(input: CreateNoteInput): Promise<InternalNote> {
    const {
      conversationId,
      agentId,
      companyId,
      type = "general",
      content,
      isPinned = false,
      mentions = [],
    } = input;

    const id = uuidv4();
    const now = new Date();

    // Extract mentions from content (e.g., @username)
    const extractedMentions = this.extractMentions(content);
    const allMentions = [...new Set([...mentions, ...extractedMentions])];

    await db.execute(sql`
      INSERT INTO chatapp_internal_notes (
        id, conversation_id, agent_id, company_id, type, content,
        is_pinned, mentions, created_at, updated_at
      ) VALUES (
        ${id}, ${conversationId}, ${agentId}, ${companyId}, ${type}, ${content},
        ${isPinned}, ${JSON.stringify(allMentions)}::jsonb, ${now}, ${now}
      )
    `);

    // Get agent name for response
    const agentResult = await db.execute<{ name: string }>(sql`
      SELECT name FROM chatapp_users WHERE id = ${agentId}
    `);
    const agentName = agentResult[0]?.name || "Unknown Agent";

    return {
      id,
      conversationId,
      agentId,
      agentName,
      companyId,
      type,
      content,
      isPinned,
      mentions: allMentions,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update an existing note
   */
  async update(noteId: string, agentId: string, input: UpdateNoteInput): Promise<InternalNote | null> {
    const { type, content, isPinned, mentions } = input;
    const now = new Date();

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];

    if (type !== undefined) {
      updates.push("type = $" + (values.length + 1));
      values.push(type);
    }
    if (content !== undefined) {
      updates.push("content = $" + (values.length + 1));
      values.push(content);
      // Re-extract mentions if content changed
      if (mentions === undefined) {
        const extractedMentions = this.extractMentions(content);
        updates.push("mentions = $" + (values.length + 1) + "::jsonb");
        values.push(JSON.stringify(extractedMentions));
      }
    }
    if (isPinned !== undefined) {
      updates.push("is_pinned = $" + (values.length + 1));
      values.push(isPinned);
    }
    if (mentions !== undefined) {
      updates.push("mentions = $" + (values.length + 1) + "::jsonb");
      values.push(JSON.stringify(mentions));
    }

    if (updates.length === 0) {
      return this.getById(noteId);
    }

    updates.push("updated_at = $" + (values.length + 1));
    values.push(now);

    // Verify ownership and update
    await db.execute(sql`
      UPDATE chatapp_internal_notes
      SET ${sql.raw(updates.join(", "))}
      WHERE id = ${noteId} AND agent_id = ${agentId}
    `);

    return this.getById(noteId);
  }

  /**
   * Delete a note
   */
  async delete(noteId: string, agentId: string): Promise<boolean> {
    const result = await db.execute(sql`
      DELETE FROM chatapp_internal_notes
      WHERE id = ${noteId} AND agent_id = ${agentId}
    `);
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  /**
   * Get a note by ID
   */
  async getById(noteId: string): Promise<InternalNote | null> {
    const result = await db.execute<{
      id: string;
      conversation_id: string;
      agent_id: string;
      company_id: string;
      type: NoteType;
      content: string;
      is_pinned: boolean;
      mentions: string[];
      created_at: Date;
      updated_at: Date;
      agent_name: string;
    }>(sql`
      SELECT n.*, u.name as agent_name
      FROM chatapp_internal_notes n
      LEFT JOIN chatapp_users u ON n.agent_id = u.id
      WHERE n.id = ${noteId}
    `);

    if (!result[0]) return null;

    return this.mapToNote(result[0]);
  }

  /**
   * Get all notes for a conversation
   */
  async getByConversation(
    conversationId: string,
    options: { limit?: number; offset?: number; pinnedFirst?: boolean } = {}
  ): Promise<InternalNote[]> {
    const { limit = 50, offset = 0, pinnedFirst = true } = options;

    const orderBy = pinnedFirst
      ? "is_pinned DESC, created_at DESC"
      : "created_at DESC";

    const result = await db.execute<{
      id: string;
      conversation_id: string;
      agent_id: string;
      company_id: string;
      type: NoteType;
      content: string;
      is_pinned: boolean;
      mentions: string[];
      created_at: Date;
      updated_at: Date;
      agent_name: string;
    }>(sql`
      SELECT n.*, u.name as agent_name
      FROM chatapp_internal_notes n
      LEFT JOIN chatapp_users u ON n.agent_id = u.id
      WHERE n.conversation_id = ${conversationId}
      ORDER BY ${sql.raw(orderBy)}
      LIMIT ${limit} OFFSET ${offset}
    `);

    return result.map(this.mapToNote);
  }

  /**
   * Get all notes created by an agent
   */
  async getByAgent(
    agentId: string,
    options: { limit?: number; offset?: number; conversationId?: string } = {}
  ): Promise<InternalNote[]> {
    const { limit = 50, offset = 0, conversationId } = options;

    let whereClause = `n.agent_id = '${agentId}'`;
    if (conversationId) {
      whereClause += ` AND n.conversation_id = '${conversationId}'`;
    }

    const result = await db.execute<{
      id: string;
      conversation_id: string;
      agent_id: string;
      company_id: string;
      type: NoteType;
      content: string;
      is_pinned: boolean;
      mentions: string[];
      created_at: Date;
      updated_at: Date;
      agent_name: string;
    }>(sql`
      SELECT n.*, u.name as agent_name
      FROM chatapp_internal_notes n
      LEFT JOIN chatapp_users u ON n.agent_id = u.id
      WHERE ${sql.raw(whereClause)}
      ORDER BY n.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return result.map(this.mapToNote);
  }

  /**
   * Get notes where an agent is mentioned
   */
  async getMentions(
    agentId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<InternalNote[]> {
    const { limit = 50, offset = 0 } = options;

    const result = await db.execute<{
      id: string;
      conversation_id: string;
      agent_id: string;
      company_id: string;
      type: NoteType;
      content: string;
      is_pinned: boolean;
      mentions: string[];
      created_at: Date;
      updated_at: Date;
      agent_name: string;
    }>(sql`
      SELECT n.*, u.name as agent_name
      FROM chatapp_internal_notes n
      LEFT JOIN chatapp_users u ON n.agent_id = u.id
      WHERE n.mentions @> ${JSON.stringify([agentId])}::jsonb
      ORDER BY n.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return result.map(this.mapToNote);
  }

  /**
   * Toggle pin status
   */
  async togglePin(noteId: string, agentId: string): Promise<InternalNote | null> {
    await db.execute(sql`
      UPDATE chatapp_internal_notes
      SET is_pinned = NOT is_pinned, updated_at = NOW()
      WHERE id = ${noteId} AND agent_id = ${agentId}
    `);

    return this.getById(noteId);
  }

  /**
   * Search notes by content
   */
  async search(
    companyId: string,
    query: string,
    options: { limit?: number; conversationId?: string } = {}
  ): Promise<InternalNote[]> {
    const { limit = 20, conversationId } = options;

    let whereClause = `n.company_id = '${companyId}' AND n.content ILIKE '%${query}%'`;
    if (conversationId) {
      whereClause += ` AND n.conversation_id = '${conversationId}'`;
    }

    const result = await db.execute<{
      id: string;
      conversation_id: string;
      agent_id: string;
      company_id: string;
      type: NoteType;
      content: string;
      is_pinned: boolean;
      mentions: string[];
      created_at: Date;
      updated_at: Date;
      agent_name: string;
    }>(sql`
      SELECT n.*, u.name as agent_name
      FROM chatapp_internal_notes n
      LEFT JOIN chatapp_users u ON n.agent_id = u.id
      WHERE ${sql.raw(whereClause)}
      ORDER BY n.created_at DESC
      LIMIT ${limit}
    `);

    return result.map(this.mapToNote);
  }

  /**
   * Extract @mentions from content
   */
  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);
    return matches ? matches.map((m) => m.slice(1)) : [];
  }

  /**
   * Map database row to InternalNote
   */
  private mapToNote(row: {
    id: string;
    conversation_id: string;
    agent_id: string;
    company_id: string;
    type: NoteType;
    content: string;
    is_pinned: boolean;
    mentions: string[];
    created_at: Date;
    updated_at: Date;
    agent_name: string;
  }): InternalNote {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      agentId: row.agent_id,
      agentName: row.agent_name || "Unknown Agent",
      companyId: row.company_id,
      type: row.type,
      content: row.content,
      isPinned: row.is_pinned,
      mentions: row.mentions || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
let notesServiceInstance: NotesService | null = null;

export function getNotesService(): NotesService {
  if (!notesServiceInstance) {
    notesServiceInstance = new NotesService();
  }
  return notesServiceInstance;
}

// Convenience functions
export async function createNote(input: CreateNoteInput): Promise<InternalNote> {
  return getNotesService().create(input);
}

export async function updateNote(
  noteId: string,
  agentId: string,
  input: UpdateNoteInput
): Promise<InternalNote | null> {
  return getNotesService().update(noteId, agentId, input);
}

export async function deleteNote(noteId: string, agentId: string): Promise<boolean> {
  return getNotesService().delete(noteId, agentId);
}

export async function getNotesByConversation(
  conversationId: string,
  options?: { limit?: number; offset?: number; pinnedFirst?: boolean }
): Promise<InternalNote[]> {
  return getNotesService().getByConversation(conversationId, options);
}

export async function getNotesByAgent(
  agentId: string,
  options?: { limit?: number; offset?: number; conversationId?: string }
): Promise<InternalNote[]> {
  return getNotesService().getByAgent(agentId, options);
}
