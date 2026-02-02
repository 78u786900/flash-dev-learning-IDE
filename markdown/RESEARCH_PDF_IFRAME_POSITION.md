# Research: Store PDF Scroll Position in Timeline While Keeping iframe Experience

**Goal:** Keep the current PDF iframe (native browser viewer with toolbar, draw, highlight) and still store the latest page in the timeline when the user stops scrolling.

---

## Summary

**With the native browser PDF iframe (`src={file.url}`), it is not possible to read scroll position or current page from the parent.** Browsers do not expose any API for this, and same-origin rules block DOM access. The only way to get page/scroll and write it to the timeline is to use a **same-origin PDF viewer inside an iframe** (e.g. Mozilla PDF.js default viewer or your custom `pdf-viewer.html`). That approach replaces the native Chrome PDF toolbar, so you trade “native draw/highlight” for “stored reading position”.

---

## 1. Why the Native PDF iframe Cannot Report Position

- **Chrome’s built-in PDF viewer (PDFium)**  
  - Renders the PDF inside the iframe.  
  - Does **not** expose any JavaScript API (no `postMessage`, no events) to the parent.  
  - There is no supported way to get “current page” or “scroll position” from the parent page.  
  - See e.g. [JS: Chrome PDF IFrame - get scroll position](https://stackoverflow.com/questions/60321077/js-chrome-pdf-iframe-get-scroll-position), [JavaScript and pdfium - get current page number](https://stackoverflow.com/questions/61702797/javascript-and-pdfium-native-chrome-pdf-viewer-can-you-get-current-page-numbe).

- **Same-origin / cross-origin**  
  - When the iframe shows a PDF (whether via `blob:` URL or direct `https:` URL), the browser treats the content as its own (e.g. Chrome’s internal viewer).  
  - The parent page does **not** get same-origin access to that content: `iframe.contentDocument` is `null` or cross-origin, so you cannot read `scrollTop`/`scrollY` or any DOM.  
  - So even with a “same-origin” blob URL, you still cannot read scroll or page from the parent.

**Conclusion:** For `src={file.url}` (native PDF viewer), there is no way to “store the latest position in the timeline when the user stops scrolling” from the parent. No workaround exists without changing how the PDF is displayed.

---

## 2. What *Does* Work: Same-Origin HTML Viewer in an iframe

To know “current page” (and optionally “scroll stopped”), the PDF must be shown by **your own HTML/JS** (or a viewer you host) inside an iframe that is **same-origin** with the parent. Then either:

- The viewer sends the page (and total pages) to the parent via `postMessage` when scroll stops, or  
- The parent reads the current page from the iframe’s DOM (e.g. `#pageNumber` in PDF.js viewer).

So “store latest position in timeline when user stops scrolling” is possible only if you **replace** the native PDF iframe with a same-origin viewer iframe.

---

## 3. Options That Preserve “iframe” but Change the Viewer

You still keep “everything about iframe” in the sense that the PDF is shown inside an iframe; you only change *what* is loaded in that iframe.

### Option A: Your Existing Custom Viewer (`public/pdf-viewer.html`)

- **How:** iframe `src="/pdf-viewer.html?url=<encoded-pdf-url>"`.  
- **Position:** The page already uses IntersectionObserver and sends `postMessage({ type: 'reading_position', page, totalPages })` when scroll stops (e.g. 400 ms debounce).  
- **Toolbar:** Minimal (no native Chrome toolbar). No built-in draw/highlight like Chrome’s PDFium.  
- **Trade-off:** You get “store latest position in timeline when user stops scrolling”; you lose the native PDF toolbar (including draw/highlight).

### Option B: Mozilla PDF.js Default Viewer (hosted same-origin)

- **How:** Copy Mozilla’s [pdf.js viewer](https://github.com/mozilla/pdf.js) (e.g. `web/viewer.html` and its build) into your app (e.g. under `public/`), and load PDF via viewer URL, e.g. `/viewer.html?file=<encoded-pdf-url>`.  
- **Position:** Same-origin ⇒ parent can read current page from the viewer’s DOM, e.g.  
  `iframe.contentDocument.getElementById('pageNumber').value`  
  (see [How can I get the current PDF page number from PDF.js iframe?](https://stackoverflow.com/questions/35873181/how-can-i-get-the-current-pdf-page-number-from-pdf-js-iframe)).  
  You can poll this on an interval or use a `MutationObserver` / input listener inside the viewer (if you patch the viewer) and then either postMessage to parent or let parent poll. When scroll stops, you’d typically debounce (e.g. 400 ms) and then read page and push to timeline.  
- **Toolbar:** Full PDF.js UI (zoom, page nav, find, etc.). The **open-source** default viewer does **not** offer the same draw/highlight as Chrome’s native viewer; annotation/drawing is limited or requested (e.g. [pdf.js#20146](https://github.com/mozilla/pdf.js/issues/20146)).  
- **Trade-off:** Same as Option A: you gain “store latest position in timeline”; you lose Chrome’s native draw/highlight unless you add or integrate an annotation layer yourself.

### Option C: Keep Native PDF iframe (Current Setup)

- **How:** No change: `iframe src={file.url}`.  
- **Position:** Not available. Timeline cannot be updated automatically from scroll.  
- **Toolbar:** Full Chrome native (including draw/highlight).  
- **Trade-off:** You keep “everything about iframe” in terms of UX (native toolbar), but you **cannot** store the latest position in the timeline when the user stops scrolling.

---

## 4. Practical Recommendation

- If **storing scroll/position in the timeline** is required:  
  Use **Option A** (existing `pdf-viewer.html`) or **Option B** (hosted PDF.js viewer). Both keep “everything about iframe” in the sense that the PDF is still in an iframe; both require giving up the **native** Chrome PDF toolbar and its draw/highlight.
- If **native toolbar (including draw/highlight)** is required:  
  Keep **Option C** and accept that reading position will not be stored automatically on scroll; you could only add a manual “Log current page” or similar if you later add a non-native way to input page.

There is no browser or Chrome API that allows “native PDF iframe + parent knows scroll/page”. The choice is binary: native viewer (no position) vs same-origin viewer (position, different toolbar).

---

## 5. Minimal Implementation (If You Choose Option A Again)

To wire Option A back into the app and store the latest position in the timeline when the user stops scrolling:

1. **FileViewer (PDF branch)**  
   - Use the custom viewer iframe instead of the native one, e.g.  
     `src={\`/pdf-viewer.html?url=${encodeURIComponent(file.url)}\`}`  
   - Add a `useEffect` that subscribes to `window.addEventListener('message', handler)`.  
   - In the handler, if `event.data?.type === 'reading_position'`, call  
     `onReadingPosition?.({ fileId: file.id, fileName: file.name, page: event.data.page })`  
     (and `onPdfPageChange?.(event.data.page)` if you use it).  
   - Optionally validate `event.origin` for production.

2. **App**  
   - Keep passing `onReadingPosition` and `onPdfPageChange` into `FileViewer` as you do now.  
   - `onReadingPosition` already updates `viewingPdfPageNumber` and `logAction('reading_position', ...)`, so the latest position will be stored in the timeline when the viewer posts after scroll stop.

3. **Optional**  
   - In `pdf-viewer.html`, consider reporting `totalPages` in the message so the parent can show “page N / M” if needed.

This keeps “everything about iframe” (PDF in an iframe, no extra UI in the main app) and restores “store latest position in timeline when user stops scrolling”, at the cost of using your custom viewer instead of the native one.
