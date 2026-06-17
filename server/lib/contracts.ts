import { getDb } from './db'
import { ValidationError } from './errors'

export async function contractsForEmployee(employeeId: string) {
  const db = getDb()
  return db`
    SELECT ec.*, d.title AS document_title
    FROM employee_contracts ec
    LEFT JOIN documents d ON d.id = ec.document_id
    WHERE ec.employee_id = ${employeeId}
    ORDER BY ec.start_date DESC
  `
}

export async function createContract(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO employee_contracts (employee_id, contract_type, start_date, end_date, hourly_rate, weekly_hours, document_id)
    VALUES (${String(data.employee_id)}, ${String(data.contract_type ?? 'permanent')},
      ${String(data.start_date)}, ${data.end_date ? String(data.end_date) : null},
      ${data.hourly_rate != null ? Number(data.hourly_rate) : null},
      ${data.weekly_hours != null ? Number(data.weekly_hours) : null},
      ${data.document_id ? String(data.document_id) : null})
    RETURNING id
  `
  const rows = await db`SELECT * FROM employee_contracts WHERE id = ${row.id}`
  return rows[0]
}

export async function deleteContract(id: string): Promise<boolean> {
  const db = getDb()
  const result = await db`DELETE FROM employee_contracts WHERE id = ${id}`
  return result.count > 0
}

export async function bankAccountsForEmployee(employeeId: string) {
  const db = getDb()
  return db`
    SELECT * FROM employee_bank_accounts WHERE employee_id = ${employeeId}
    ORDER BY is_primary DESC
  `
}

export async function createBankAccount(data: Record<string, unknown>) {
  const db = getDb()
  const [row] = await db`
    INSERT INTO employee_bank_accounts (employee_id, bank_name, account_name, account_no, routing_no, is_primary)
    VALUES (${String(data.employee_id)}, ${String(data.bank_name)}, ${String(data.account_name ?? '')},
      ${String(data.account_no)}, ${data.routing_no ? String(data.routing_no) : null},
      ${Boolean(data.is_primary)})
    RETURNING id
  `
  const rows = await db`SELECT * FROM employee_bank_accounts WHERE id = ${row.id}`
  return rows[0]
}

export async function serviceRecord(employeeId: string) {
  const db = getDb()
  const rows = await db`
    SELECT e.*, b.name AS branch_name, d.name AS department_name, p.title AS position_title
    FROM employees e
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions p ON p.id = e.position_id
    WHERE e.id = ${employeeId} LIMIT 1
  `
  if (!rows[0]) throw new ValidationError('Employee not found')
  return {
    employee: rows[0],
    contracts: await contractsForEmployee(employeeId),
    bank_accounts: await bankAccountsForEmployee(employeeId),
  }
}
