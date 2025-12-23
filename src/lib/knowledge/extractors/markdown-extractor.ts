/**
 * Markdown Content Extractor
 *
 * Extracts text content from Markdown documents.
 * Handles heading-based section extraction and preserves structure.
 */

import {
  BaseExtractor,
  ExtractionResult,
  ContentSection,
  ExtractorOptions,
  ExtractionError,
} from "./base-extractor";

/**
 * Markdown Extractor Class
 */
export class MarkdownExtractor extends BaseExtractor {
  constructor(options: Partial<ExtractorOptions> = {}) {
    super(options);
  }

  getSupportedMimeTypes(): string[] {
    return ["text/markdown", "text/x-markdown"];
  }

  getSupportedExtensions(): string[] {
    return ["md", "mdx", "markdown"];
  }

  async extract(input: Buffer | string): Promise<ExtractionResult> {
    try {
      const markdown =
        typeof input === "string"
          ? input
          : input.toString(this.options.encoding as BufferEncoding ?? "utf-8");

      // Convert markdown to plain text
      const content = this.cleanText(this.convertToPlainText(markdown));

      // Extract title from first heading
      const title = this.extractTitle(markdown);

      // Extract sections
      const sections = this.options.extractSections
        ? this.extractSections(markdown)
        : undefined;

      return {
        content,
        metadata: this.createMetadata(content, "text/markdown", {
          title,
          customMetadata: {
            headingCount: this.countHeadings(markdown),
            hasCodeBlocks: /```[\s\S]*?```/.test(markdown),
            hasLinks: /\[([^\]]+)\]\([^)]+\)/.test(markdown),
            hasImages: /!\[.*?\]\(.*?\)/.test(markdown),
          },
        }),
        sections,
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Failed to extract Markdown content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "MarkdownExtractor",
        error
      );
    }
  }

  /**
   * Convert markdown to plain text
   */
  private convertToPlainText(markdown: string): string {
    let text = markdown;

    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, "");
    text = text.replace(/`[^`]+`/g, "");

    // Remove images
    text = text.replace(/!\[.*?\]\(.*?\)/g, "");

    // Remove links but keep text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Remove reference-style links
    text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
    text = text.replace(/^\[[^\]]+\]:.*$/gm, "");

    // Remove headers markers but keep text
    text = text.replace(/^#{1,6}\s+/gm, "");

    // Remove emphasis markers
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
    text = text.replace(/___([^_]+)___/g, "$1");
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/__([^_]+)__/g, "$1");
    text = text.replace(/\*([^*]+)\*/g, "$1");
    text = text.replace(/_([^_]+)_/g, "$1");

    // Remove strikethrough
    text = text.replace(/~~([^~]+)~~/g, "$1");

    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}$/gm, "");

    // Remove blockquotes
    text = text.replace(/^>\s*/gm, "");

    // Remove list markers
    text = text.replace(/^[\s]*[-*+]\s+/gm, "");
    text = text.replace(/^[\s]*\d+\.\s+/gm, "");

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Clean up
    text = text.replace(/\n{3,}/g, "\n\n");

    return text;
  }

  /**
   * Extract title from markdown
   */
  private extractTitle(markdown: string): string | undefined {
    // Try H1 with # syntax
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match?.[1]) {
      return h1Match[1].trim();
    }

    // Try H1 with underline syntax
    const underlineH1Match = markdown.match(/^(.+)\n=+$/m);
    if (underlineH1Match?.[1]) {
      return underlineH1Match[1].trim();
    }

    // Fall back to first non-empty line if it's short enough
    const firstLine = markdown.split("\n").find((line) => line.trim());
    if (firstLine && firstLine.length < 200 && !firstLine.startsWith("```")) {
      return firstLine.trim();
    }

    return undefined;
  }

  /**
   * Count headings in markdown
   */
  private countHeadings(markdown: string): number {
    const hashHeadings = markdown.match(/^#{1,6}\s+.+$/gm) ?? [];
    const underlineH1 = markdown.match(/^.+\n=+$/gm) ?? [];
    const underlineH2 = markdown.match(/^.+\n-+$/gm) ?? [];

    return hashHeadings.length + underlineH1.length + underlineH2.length;
  }

  /**
   * Extract sections from markdown headings
   */
  private extractSections(markdown: string): ContentSection[] {
    const sections: ContentSection[] = [];
    let sectionIndex = 0;

    // Find all headings with their positions
    const headings: Array<{
      level: number;
      title: string;
      startIndex: number;
    }> = [];

    // Hash-style headings
    const hashPattern = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = hashPattern.exec(markdown)) !== null) {
      const level = match[1];
      const title = match[2];
      if (level && title) {
        headings.push({
          level: level.length,
          title: title.trim(),
          startIndex: match.index,
        });
      }
    }

    // Underline-style H1
    const underlineH1Pattern = /^(.+)\n(=+)$/gm;
    while ((match = underlineH1Pattern.exec(markdown)) !== null) {
      const title = match[1];
      if (title) {
        headings.push({
          level: 1,
          title: title.trim(),
          startIndex: match.index,
        });
      }
    }

    // Underline-style H2
    const underlineH2Pattern = /^(.+)\n(-+)$/gm;
    while ((match = underlineH2Pattern.exec(markdown)) !== null) {
      const title = match[1];
      if (title) {
        headings.push({
          level: 2,
          title: title.trim(),
          startIndex: match.index,
        });
      }
    }

    // Sort by position
    headings.sort((a, b) => a.startIndex - b.startIndex);

    if (headings.length === 0) {
      // No headings - return single section
      const content = this.convertToPlainText(markdown).trim();
      if (content) {
        return [{ content, index: 0 }];
      }
      return [];
    }

    // Extract content before first heading
    const firstHeading = headings[0];
    if (firstHeading && firstHeading.startIndex > 0) {
      const introContent = markdown.slice(0, firstHeading.startIndex).trim();
      const plainIntro = this.convertToPlainText(introContent).trim();
      if (plainIntro) {
        sections.push({
          content: plainIntro,
          index: sectionIndex++,
        });
      }
    }

    // Extract content for each heading
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      if (!heading) continue;

      const nextHeading = headings[i + 1];
      const sectionEnd = nextHeading ? nextHeading.startIndex : markdown.length;

      // Get content after heading line
      const headingEndMatch = markdown.slice(heading.startIndex).match(/^.+\n/);
      const headingEnd = heading.startIndex + (headingEndMatch?.[0].length ?? 0);
      const sectionContent = markdown.slice(headingEnd, sectionEnd).trim();

      const plainContent = this.convertToPlainText(sectionContent).trim();
      if (plainContent) {
        sections.push({
          title: heading.title,
          content: plainContent,
          level: heading.level,
          index: sectionIndex++,
        });
      }
    }

    return sections;
  }
}

// Export singleton instance
export const markdownExtractor = new MarkdownExtractor();
