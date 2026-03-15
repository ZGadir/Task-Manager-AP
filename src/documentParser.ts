// src/documentParser.ts
// Handles PDF and Word document text extraction

import * as mammoth from 'mammoth'

// Extract text from a PDF file
export async function extractFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfjsLib = await import('pdfjs-dist')

    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
      fullText += pageText + '\n'
    }

    return fullText.trim()
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to read PDF file')
  }
}

// Extract text from a Word (.docx) file
export async function extractFromWord(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
  } catch (error) {
    console.error('Word extraction error:', error)
    throw new Error('Failed to read Word file')
  }
}

// Main function — detects file type and extracts text
export async function extractDocumentText(file: File): Promise<string> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.pdf')) {
    return await extractFromPDF(file)
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return await extractFromWord(file)
  } else {
    throw new Error('Unsupported file type. Please use PDF or Word documents.')
  }
}

// Summarise document text if it's too long
export function truncateDocument(text: string, maxChars = 3000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[Document truncated for processing...]'
}
