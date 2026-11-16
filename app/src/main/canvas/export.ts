import { access, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import PptxGenJS from 'pptxgenjs'
import { CANVAS_EXPORT_EXTENSIONS, type CanvasExportFormat } from '../../shared/canvas'
import { renderScreenImage, renderScreenPdf } from './capture'
import { CanvasError, exportFileName } from './rules'

/** Экран, готовый к выгрузке: страница по адресу и размер, в котором её рисовать. */
export interface ExportScreen {
  name: string
  url: string
  width: number
  height: number
}

/** Длинная сторона слайда в PowerPoint, дюймов: как у стандартного широкого слайда 13,33 × 7,5. */
const SLIDE_LONG_SIDE_INCHES = 13.333

function renderFailed(name: string): CanvasError {
  return new CanvasError(
    `Could not render the screen "${name}". Check that it opens on the canvas without errors.`
  )
}

/** Все экраны в один PDF: страница на экран, размер страницы равен размеру экрана. */
async function buildPdf(screens: readonly ExportScreen[], title: string): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(title)
  document.setProducer('Atox')
  for (const screen of screens) {
    const rendered = await renderScreenPdf(screen.url, screen.width, screen.height)
    if (!rendered) {
      throw renderFailed(screen.name)
    }
    const page = await PDFDocument.load(rendered)
    const [copied] = await document.copyPages(page, [0])
    if (!copied) {
      throw renderFailed(screen.name)
    }
    document.addPage(copied)
  }
  return document.save()
}

async function renderImages(screens: readonly ExportScreen[]): Promise<Buffer[]> {
  const images: Buffer[] = []
  for (const screen of screens) {
    const image = await renderScreenImage(screen.url, screen.width, screen.height)
    if (!image) {
      throw renderFailed(screen.name)
    }
    images.push(image)
  }
  return images
}

/**
 * Слайды PowerPoint из картинок экранов: текст на них не редактируется, зато выглядит
 * ровно как на холсте. Размер слайдов — по первому экрану, остальные вписываются по центру.
 */
async function buildPresentation(
  screens: readonly ExportScreen[],
  title: string
): Promise<Buffer> {
  const [first] = screens
  if (!first) {
    throw new CanvasError('There are no screens to export.')
  }
  const images = await renderImages(screens)
  const scale = SLIDE_LONG_SIDE_INCHES / Math.max(first.width, first.height)
  const layout = { width: first.width * scale, height: first.height * scale }
  const presentation = new PptxGenJS()
  presentation.defineLayout({ name: 'ATOX', ...layout })
  presentation.layout = 'ATOX'
  presentation.title = title
  presentation.company = 'Atox'
  screens.forEach((screen, index) => {
    const fit = Math.min(layout.width / screen.width, layout.height / screen.height)
    const width = screen.width * fit
    const height = screen.height * fit
    presentation.addSlide().addImage({
      data: `image/png;base64,${images[index]!.toString('base64')}`,
      x: (layout.width - width) / 2,
      y: (layout.height - height) / 2,
      w: width,
      h: height,
      altText: screen.name
    })
  })
  const data = await presentation.write({ outputType: 'nodebuffer' })
  return Buffer.from(data as Buffer)
}

/** PNG по файлу на экран в папке: «01 Login.png», «02 Home.png». */
async function writeImages(screens: readonly ExportScreen[], folder: string): Promise<void> {
  const images = await renderImages(screens)
  await mkdir(folder, { recursive: true })
  const digits = String(screens.length).length
  const used = new Set<string>()
  await Promise.all(
    screens.map((screen, index) => {
      let name = exportFileName(screen.name, `Screen ${index + 1}`)
      // Одинаковые имена экранов не должны затирать друг друга.
      while (used.has(name.toLowerCase())) {
        name = `${name} ${index + 1}`
      }
      used.add(name.toLowerCase())
      const prefix = String(index + 1).padStart(digits, '0')
      return writeFile(join(folder, `${prefix} ${name}.png`), images[index]!)
    })
  )
}

/**
 * Выгружает экраны в `target`: файл для PDF и PPTX, папка для PNG. Экраны идут в том порядке,
 * в каком переданы. Падает с понятной ошибкой, если экран не отрисовался.
 */
export async function exportScreens(
  format: CanvasExportFormat,
  screens: readonly ExportScreen[],
  target: string,
  title: string
): Promise<void> {
  if (screens.length === 0) {
    throw new CanvasError('There are no screens to export.')
  }
  switch (format) {
    case 'png':
      await writeImages(screens, target)
      return
    case 'pdf':
    case 'pptx': {
      const content =
        format === 'pdf' ? await buildPdf(screens, title) : await buildPresentation(screens, title)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, content)
      return
    }
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

/** Свободный путь рядом с `directory/name`: «Name.pdf», «Name 2.pdf», «Name 3.pdf»… */
export async function freeExportPath(
  directory: string,
  name: string,
  format: CanvasExportFormat
): Promise<string> {
  const base = exportFileName(name, 'Canvas')
  const extension = CANVAS_EXPORT_EXTENSIONS[format]
  for (let attempt = 1; ; attempt++) {
    const candidate = join(directory, `${attempt === 1 ? base : `${base} ${attempt}`}${extension}`)
    if (!(await exists(candidate))) {
      return candidate
    }
  }
}

/** Путь, который назвал агент, пригоден для формата: у файла нужное расширение. */
export function checkExportTarget(format: CanvasExportFormat, target: string): void {
  const extension = CANVAS_EXPORT_EXTENSIONS[format]
  if (extension && extname(target).toLowerCase() !== extension) {
    throw new CanvasError(
      `The output path for ${format.toUpperCase()} must end with ${extension}: "${basename(target)}".`
    )
  }
}
