/**
 * Crop image to bounding box
 */
export function cropImage(
  imageDataUrl: string,
  bbox: { x: number; y: number; w: number; h: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = bbox.w
      canvas.height = bbox.h
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      ctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = imageDataUrl
  })
}

/**
 * Preprocess image for better OCR
 */
export function preprocessImage(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        resolve(imageDataUrl)
        return
      }
      
      // Draw original
      ctx.drawImage(img, 0, 0)
      
      // Convert to grayscale
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        data[i] = data[i + 1] = data[i + 2] = gray
      }
      
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = imageDataUrl
  })
}

/**
 * Correct common OCR errors in math mode
 */
export function correctMathSymbols(text: string): string {
  let corrected = text
  
  // O (letter) → 0 (zero) in equations
  corrected = corrected.replace(/([0-9\s])O([0-9\s])/g, '$10$2')
  
  // l (lowercase L) → 1 (one) in equations
  corrected = corrected.replace(/([0-9\s])l([0-9\s])/g, '$11$2')
  
  // x → × between numbers
  corrected = corrected.replace(/([0-9])\s*x\s*([0-9])/g, '$1 × $2')
  
  // ^ → superscript markers
  corrected = corrected.replace(/\^(\d+)/g, '^{$1}')
  
  return corrected
}

/**
 * Convert text to LaTeX (basic)
 */
export function textToLatex(text: string): string {
  let latex = text
  
  // Fractions
  latex = latex.replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}')
  
  // Square root
  latex = latex.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
  latex = latex.replace(/√(\d+)/g, '\\sqrt{$1}')
  
  // Superscript
  latex = latex.replace(/\^(\d+)/g, '^{$1}')
  
  // Subscript
  latex = latex.replace(/_(\d+)/g, '_{$1}')
  
  return latex
}
