/**
 * HTML Content Extractor
 *
 * Extracts text content from HTML documents using cheerio.
 * Handles heading-based section extraction and metadata.
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import {
  BaseExtractor,
  ExtractionResult,
  ContentSection,
  ExtractorOptions,
  ExtractionError,
} from "./base-extractor";

/**
 * HTML Extractor Class
 */
export class HtmlExtractor extends BaseExtractor {
  constructor(options: Partial<ExtractorOptions> = {}) {
    super(options);
  }

  getSupportedMimeTypes(): string[] {
    return ["text/html", "application/xhtml+xml"];
  }

  getSupportedExtensions(): string[] {
    return ["html", "htm", "xhtml"];
  }

  async extract(input: Buffer | string): Promise<ExtractionResult> {
    try {
      const html =
        typeof input === "string"
          ? input
          : input.toString(this.options.encoding as BufferEncoding ?? "utf-8");

      const $ = cheerio.load(html);

      // Remove non-content elements
      $(
        "script, style, noscript, iframe, nav, footer, header, aside, .sidebar, .navigation, .menu, .ad, .advertisement, .comments"
      ).remove();

      // Extract title
      const title =
        $("title").text().trim() ||
        $("h1").first().text().trim() ||
        $('meta[property="og:title"]').attr("content") ||
        undefined;

      // Extract author
      const author =
        $('meta[name="author"]').attr("content") ||
        $('meta[property="article:author"]').attr("content") ||
        $('[rel="author"]').first().text().trim() ||
        undefined;

      // Get main content area
      const mainContent = this.findMainContent($);
      const content = this.cleanText(mainContent);

      // Extract sections from headings
      const sections = this.options.extractSections
        ? this.extractSections($)
        : undefined;

      return {
        content,
        metadata: this.createMetadata(content, "text/html", {
          title,
          author,
          customMetadata: {
            description:
              $('meta[name="description"]').attr("content") ||
              $('meta[property="og:description"]').attr("content"),
            keywords: $('meta[name="keywords"]').attr("content"),
            canonical: $('link[rel="canonical"]').attr("href"),
          },
        }),
        sections,
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Failed to extract HTML content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "HtmlExtractor",
        error
      );
    }
  }

  /**
   * Find the main content area of the page
   */
  private findMainContent($: cheerio.CheerioAPI): string {
    // Try common content selectors in order of preference
    const selectors = [
      "article",
      'main',
      '[role="main"]',
      ".content",
      ".post-content",
      ".article-content",
      ".entry-content",
      "#content",
      "#main",
      ".main",
      "body",
    ];

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 100) {
          return text;
        }
      }
    }

    // Fallback to body
    return $("body").text() || $.text();
  }

  /**
   * Extract sections from heading structure
   */
  private extractSections($: cheerio.CheerioAPI): ContentSection[] {
    const sections: ContentSection[] = [];
    let sectionIndex = 0;

    // Build heading hierarchy
    const headings: Array<{
      level: number;
      text: string;
      element: cheerio.Cheerio<AnyNode>;
    }> = [];

    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      const $heading = $(el);
      const tagName = $heading.prop("tagName")?.toLowerCase() ?? "";
      const level = parseInt(tagName.replace("h", ""), 10);

      headings.push({
        level,
        text: $heading.text().trim(),
        element: $heading,
      });
    });

    if (headings.length === 0) {
      // No headings - return single section with all content
      const bodyContent = this.findMainContent($);
      if (bodyContent.trim()) {
        return [
          {
            content: this.cleanText(bodyContent),
            index: 0,
          },
        ];
      }
      return [];
    }

    // Extract content between headings
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      if (!heading) continue;

      const sectionContent = this.extractContentBetweenHeadings(
        $,
        heading.element,
        headings[i + 1]?.element
      );

      if (sectionContent.trim()) {
        sections.push({
          title: heading.text,
          content: sectionContent,
          level: heading.level,
          index: sectionIndex++,
        });
      }
    }

    return sections;
  }

  /**
   * Extract content between two headings
   */
  private extractContentBetweenHeadings(
    $: cheerio.CheerioAPI,
    $startHeading: cheerio.Cheerio<AnyNode>,
    $endHeading?: cheerio.Cheerio<AnyNode>
  ): string {
    const texts: string[] = [];
    let $current = $startHeading.next();

    while ($current.length > 0) {
      const tagName = $current.prop("tagName")?.toLowerCase() ?? "";

      // Stop if we hit the end heading
      if ($endHeading && $current.is($endHeading as unknown as string)) {
        break;
      }

      // Stop if we hit another heading of same or higher level
      if (/^h[1-6]$/.test(tagName)) {
        const currentLevel = parseInt(tagName.replace("h", ""), 10);
        const startTagName = $startHeading.prop("tagName")?.toLowerCase() ?? "";
        const startLevel = parseInt(startTagName.replace("h", ""), 10);

        if (currentLevel <= startLevel) {
          break;
        }
      }

      const text = $current.text().trim();
      if (text) {
        texts.push(text);
      }

      $current = $current.next();
    }

    return this.cleanText(texts.join("\n\n"));
  }
}

// Export singleton instance
export const htmlExtractor = new HtmlExtractor();
