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

export async function bankAccountsForEmployee(employeeId: string) {
  const db = getDb()
  return db`
    SELECT * FROM employee_bank_accounts WHERE employee_id = ${employeeId}
    ORDER BY is_primary DESC
  `
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
