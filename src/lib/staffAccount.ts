import type { UserAccountDraft } from '../components/UserAccountEditPanel'
import { toDateInputValue } from './date'

/** Payload for PUT /employees/:id from the staff account editor. */
export function buildEmployeeUpdateBody(draft: UserAccountDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    first_name: draft.first_name,
    last_name: draft.last_name,
    emp_number: draft.emp_number,
    phone: draft.phone || null,
    email: draft.email,
    date_of_birth: toDateInputValue(draft.date_of_birth) || null,
    gender: draft.gender || null,
    nationality: draft.nationality || null,
    national_id: draft.national_id || null,
    address: draft.address || null,
    emergency_name: draft.emergency_name || null,
    emergency_phone: draft.emergency_phone || null,
    hire_date: toDateInputValue(draft.hire_date) || new Date().toISOString().slice(0, 10),
    is_stay_in: draft.is_stay_in,
    housing_deduction:
      draft.is_stay_in && draft.housing_deduction !== '' ? Number(draft.housing_deduction) : 0,
  }

  if (draft.branch_id) {
    body.branch_id = draft.branch_id
    body.department_id = draft.department_id || null
    body.position_id = draft.position_id || null
  }

  return body
}
