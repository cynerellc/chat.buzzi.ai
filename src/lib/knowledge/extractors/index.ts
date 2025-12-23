/**
 * Content Extractors
 *
 * Exports all content extractors and provides a factory for selecting
 * the appropriate extractor based on file type.
 */

// Base extractor types
export {
  BaseExtractor,
  ExtractionError,
  DEFAULT_EXTRACTOR_OPTIONS,
  type ExtractionResult,
  type ExtractionMetadata,
  type ContentSection,
  type ExtractorOptions,
} from "./base-extractor";

// Specific extractors
export { PDFExtractor, pdfExtractor } from "./pdf-extractor";
export { DocxExtractor, docxExtractor } from "./docx-extractor";
export { TextExtractor, textExtractor } from "./text-extractor";
export { HtmlExtractor, htmlExtractor } from "./html-extractor";
export { MarkdownExtractor, markdownExtractor } from "./markdown-extractor";

// Import for factory
import { BaseExtractor, ExtractorOptions, ExtractionResult } from "./base-extractor";
import { pdfExtractor, PDFExtractor } from "./pdf-extractor";
import { docxExtractor, DocxExtractor } from "./docx-extractor";
import { textExtractor, TextExtractor } from "./text-extractor";
import { htmlExtractor, HtmlExtractor } from "./html-extractor";
import { markdownExtractor, MarkdownExtractor } from "./markdown-extractor";

/**
 * Extractor Factory
 *
 * Returns the appropriate extractor for a given file type or MIME type.
 */
export class ExtractorFactory {
  private static extractors: BaseExtractor[] = [
    pdfExtractor,
    docxExtractor,
    htmlExtractor,
    markdownExtractor,
    textExtractor, // Text extractor is the fallback
  ];

  /**
   * Get extractor by MIME type
   */
  static getByMimeType(mimeType: string): BaseExtractor {
    const extractor = this.extractors.find((e) => e.canHandle(mimeType));
    return extractor ?? textExtractor;
  }

  /**
   * Get extractor by file extension
   */
  static getByExtension(extension: string): BaseExtractor {
    const extractor = this.extractors.find((e) =>
      e.canHandleExtension(extension)
    );
    return extractor ?? textExtractor;
  }

  /**
   * Get extractor by file name (uses extension)
   */
  static getByFileName(fileName: string): BaseExtractor {
    const extension = fileName.split(".").pop() ?? "";
    return this.getByExtension(extension);
  }

  /**
   * Create a new instance of an extractor with custom options
   */
  static create(
    type: "pdf" | "docx" | "html" | "markdown" | "text",
    options?: Partial<ExtractorOptions>
  ): BaseExtractor {
    switch (type) {
      case "pdf":
        return new PDFExtractor(options);
      case "docx":
        return new DocxExtractor(options);
      case "html":
        return new HtmlExtractor(options);
      case "markdown":
        return new MarkdownExtractor(options);
      case "text":
      default:
        return new TextExtractor(options);
    }
  }

  /**
   * Get all registered extractors
   */
  static getAll(): BaseExtractor[] {
    return [...this.extractors];
  }

  /**
   * Get all supported MIME types
   */
  static getSupportedMimeTypes(): string[] {
    const mimeTypes = new Set<string>();
    for (const extractor of this.extractors) {
      for (const mimeType of extractor.getSupportedMimeTypes()) {
        mimeTypes.add(mimeType);
      }
    }
    return Array.from(mimeTypes);
  }

  /**
   * Get all supported file extensions
   */
  static getSupportedExtensions(): string[] {
    const extensions = new Set<string>();
    for (const extractor of this.extractors) {
      for (const ext of extractor.getSupportedExtensions()) {
        extensions.add(ext);
      }
    }
    return Array.from(extensions);
  }
}

/**
 * Extract content from a file or buffer
 *
 * Convenience function that automatically selects the right extractor.
 */
export async function extractContent(
  input: Buffer | string,
  options: {
    mimeType?: string;
    fileName?: string;
    extractorOptions?: Partial<ExtractorOptions>;
  } = {}
): Promise<ExtractionResult> {
  const { mimeType, fileName, extractorOptions } = options;

  // Determine the extractor to use
  let extractor: BaseExtractor;

  if (mimeType) {
    extractor = ExtractorFactory.getByMimeType(mimeType);
  } else if (fileName) {
    extractor = ExtractorFactory.getByFileName(fileName);
  } else {
    // Default to text extractor
    extractor = textExtractor;
  }

  // If custom options provided, create new instance
  if (extractorOptions) {
    const type = getExtractorType(extractor);
    extractor = ExtractorFactory.create(type, extractorOptions);
  }

  return extractor.extract(input);
}

/**
 * Get the type identifier for an extractor
 */
function getExtractorType(
  extractor: BaseExtractor
): "pdf" | "docx" | "html" | "markdown" | "text" {
  if (extractor instanceof PDFExtractor) return "pdf";
  if (extractor instanceof DocxExtractor) return "docx";
  if (extractor instanceof HtmlExtractor) return "html";
  if (extractor instanceof MarkdownExtractor) return "markdown";
  return "text";
}

/**
 * Check if a MIME type or extension is supported
 */
export function isSupported(mimeTypeOrExtension: string): boolean {
  const mimeTypes = ExtractorFactory.getSupportedMimeTypes();
  const extensions = ExtractorFactory.getSupportedExtensions();

  const normalized = mimeTypeOrExtension.toLowerCase().replace(/^\./, "");

  return mimeTypes.includes(normalized) || extensions.includes(normalized);
}
