/**
 * DOCX Content Extractor
 *
 * Extracts text content from Microsoft Word documents using mammoth.
 * Handles heading-based section extraction.
 */

import {
  BaseExtractor,
  ExtractionResult,
  ContentSection,
  ExtractorOptions,
  ExtractionError,
} from "./base-extractor";

/**
 * DOCX Extractor Class
 */
export class DocxExtractor extends BaseExtractor {
  constructor(options: Partial<ExtractorOptions> = {}) {
    super(options);
  }

  getSupportedMimeTypes(): string[] {
    return [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
  }

  getSupportedExtensions(): string[] {
    return ["docx", "doc"];
  }

  async extract(input: Buffer | string): Promise<ExtractionResult> {
    if (typeof input === "string") {
      throw new ExtractionError(
        "DOCX extractor requires a Buffer input",
        "DocxExtractor"
      );
    }

    try {
      // Dynamic import
      const mammoth = await import("mammoth");

      // Extract raw text and HTML (for structure analysis)
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer: input }),
        mammoth.convertToHtml({ buffer: input }),
      ]);

      const content = this.cleanText(textResult.value);

      // Extract sections from HTML structure
      const sections = this.options.extractSections
        ? this.extractSectionsFromHtml(htmlResult.value)
        : undefined;

      // Try to extract title from first heading or first line
      const title = this.extractTitle(htmlResult.value, content);

      return {
        content,
        metadata: this.createMetadata(
          content,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          {
            title,
            customMetadata: {
              warnings: textResult.messages
                .filter((m) => m.type === "warning")
                .map((m) => m.message),
            },
          }
        ),
        sections,
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Failed to extract DOCX content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "DocxExtractor",
        error
      );
    }
  }

  /**
   * Extract title from HTML or raw content
   */
  private extractTitle(html: string, rawContent: string): string | undefined {
    // Try H1 first
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match?.[1]) {
      return this.stripHtmlTags(h1Match[1]).trim();
    }

    // Try first heading of any level
    const headingMatch = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
    if (headingMatch?.[1]) {
      return this.stripHtmlTags(headingMatch[1]).trim();
    }

    // Fall back to first line of content
    const firstLine = rawContent.split("\n")[0]?.trim();
    if (firstLine && firstLine.length < 200) {
      return firstLine;
    }

    return undefined;
  }

  /**
   * Extract sections from HTML structure
   */
  private extractSectionsFromHtml(html: string): ContentSection[] {
    const sections: ContentSection[] = [];

    // Parse headings and their content
    const headingPattern =
      /<h([1-6])[^>]*>(.*?)<\/h\1>|<p[^>]*>(.*?)<\/p>/gi;
    const matches: Array<{
      type: "heading" | "paragraph";
      level?: number;
      text: string;
      index: number;
    }> = [];

    let match;
    while ((match = headingPattern.exec(html)) !== null) {
      if (match[1] && match[2]) {
        // Heading
        matches.push({
          type: "heading",
          level: parseInt(match[1], 10),
          text: this.stripHtmlTags(match[2]),
          index: match.index,
        });
      } else if (match[3]) {
        // Paragraph
        matches.push({
          type: "paragraph",
          text: this.stripHtmlTags(match[3]),
          index: match.index,
        });
      }
    }

    // Group content by headings
    let currentSection: {
      title?: string;
      level?: number;
      content: string[];
      startIndex: number;
    } | null = null;
    let sectionIndex = 0;

    for (const item of matches) {
      if (item.type === "heading") {
        // Save previous section
        if (currentSection && currentSection.content.length > 0) {
          const sectionContent = currentSection.content.join("\n\n").trim();
          if (sectionContent) {
            sections.push({
              title: currentSection.title,
              content: sectionContent,
              level: currentSection.level,
              index: sectionIndex++,
            });
          }
        }

        // Start new section
        currentSection = {
          title: item.text,
          level: item.level,
          content: [],
          startIndex: item.index,
        };
      } else if (currentSection) {
        // Add paragraph to current section
        if (item.text.trim()) {
          currentSection.content.push(item.text.trim());
        }
      } else {
        // Content before first heading - create intro section
        if (item.text.trim()) {
          if (!currentSection) {
            currentSection = {
              content: [],
              startIndex: item.index,
            };
          }
          currentSection.content.push(item.text.trim());
        }
      }
    }

    // Save last section
    if (currentSection && currentSection.content.length > 0) {
      const sectionContent = currentSection.content.join("\n\n").trim();
      if (sectionContent) {
        sections.push({
          title: currentSection.title,
          content: sectionContent,
          level: currentSection.level,
          index: sectionIndex,
        });
      }
    }

    return sections;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}

// Export singleton instance
export const docxExtractor = new DocxExtractor();
