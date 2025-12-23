/**
 * Internal Notes Module
 *
 * Provides internal note-taking functionality for support agents
 * to add private notes to conversations that are not visible to customers.
 */

export {
  NotesService,
  getNotesService,
  createNote,
  updateNote,
  deleteNote,
  getNotesByConversation,
  getNotesByAgent,
  type InternalNote,
  type NoteType,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "./notes-service";
