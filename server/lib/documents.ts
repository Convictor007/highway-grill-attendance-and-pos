import { unlink } from 'fs/promises'
import path from 'path'
import { getDb } from './db'
import { ValidationError } from './errors'
import { savePublicFile } from './storage'

const CATEGORIES = new Set(['contract', 'id', 'certificate', 'payslip', 'memo', 'other'])
const MAX_BYTES = 10 * 1024 * 1024

function normalizeCategory(raw?: string) {
  const cat = String(raw ?? 'other')
  return CATEGORIES.has(cat) ? cat : 'other'
}

export async function forEmployee(employeeId: string) {
  const db = getDb()
  return db`
    SELECT id, category, title, file_url, file_type, expires_at, created_at, is_confidential
    FROM documents
    WHERE employee_id = ${employeeId} AND is_confidential = false
    ORDER BY created_at DESC
  `
}

export async function forEmployeeHr(employeeId: string) {
  const db = getDb()
  return db`
    SELECT d.id, d.employee_id, d.category, d.title, d.file_url, d.file_type, d.expires_at,
      d.created_at, d.is_confidential, e.first_name, e.last_name, e.emp_number
    FROM documents d
    INNER JOIN employees e ON e.id = d.employee_id
    WHERE d.employee_id = ${employeeId}
    ORDER BY d.created_at DESC
  `
}

async function getDocument(id: string) {
  const db = getDb()
  const rows = await db`
    SELECT d.*, e.first_name, e.last_name, e.emp_number
    FROM documents d
    INNER JOIN employees e ON e.id = d.employee_id
    WHERE d.id = ${id}
  `
  return rows[0] ?? null
}

export async function create(data: Record<string, unknown>, userId: string) {
  const employeeId = String(data.employee_id ?? '')
  if (!employeeId) throw new ValidationError('employee_id is required')
  const title = String(data.title ?? '').trim()
  if (!title) throw new ValidationError('title is required')
  const category = normalizeCategory(data.category ? String(data.category) : undefined)
  const db = getDb()
  const [row] = await db`
    INSERT INTO documents (employee_id, category, title, file_url, file_type, is_confidential, expires_at, uploaded_by)
    VALUES (${employeeId}, ${category}, ${title},
      ${data.file_url ? String(data.file_url).trim() : null},
      ${data.file_type ? String(data.file_type) : null},
      ${Boolean(data.is_confidential)},
      ${data.expires_at ? String(data.expires_at) : null}, ${userId})
    RETURNING id
  `
  return getDocument(String(row.id))
}

async function saveDocumentFile(id: string, file: File): Promise<{ url: string; fileType: string; sizeKb: number }> {
  if (!file || file.size === 0) throw new ValidationError('file is required')
  if (file.size > MAX_BYTES) throw new ValidationError('File too large (max 10 MB)')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'
  const filename = `${id}.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const mime = file.type || safeExt
  const sizeKb = Math.ceil(file.size / 1024)

  const url = await savePublicFile('documents', filename, buffer, mime)
  return { url, fileType: mime, sizeKb }
}

export async function upload(fields: Record<string, string>, file: File | null, userId: string) {
  const employeeId = fields.employee_id ?? ''
  if (!employeeId) throw new ValidationError('employee_id is required')
  const title = (fields.title ?? '').trim()
  if (!title) throw new ValidationError('title is required')
  if (!file) throw new ValidationError('file is required')
  const category = normalizeCategory(fields.category)
  const db = getDb()
  const [row] = await db`
    INSERT INTO documents (employee_id, category, title, is_confidential, expires_at, uploaded_by)
    VALUES (${employeeId}, ${category}, ${title},
      ${fields.is_confidential === '1' || fields.is_confidential === 'true'},
      ${fields.expires_at || null}, ${userId})
    RETURNING id
  `
  const id = String(row.id)
  const saved = await saveDocumentFile(id, file)
  await db`
    UPDATE documents SET file_url = ${saved.url}, file_type = ${saved.fileType}, file_size_kb = ${saved.sizeKb}
    WHERE id = ${id}
  `
  return getDocument(id)
}

export async function deleteDocument(id: string): Promise<boolean> {
  const db = getDb()
  const rows = await db`SELECT id, file_url FROM documents WHERE id = ${id} LIMIT 1`
  const row = rows[0]
  if (!row) return false
  await db`DELETE FROM documents WHERE id = ${id}`
  const url = String(row.file_url ?? '')
  if (url.startsWith('/uploads/documents/')) {
    const filename = path.basename(url)
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'documents', filename)
    try {
      await unlink(filePath)
    } catch {
      // ignore missing file
    }
  }
  return true
}
