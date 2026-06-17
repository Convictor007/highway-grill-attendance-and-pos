import { jsonOk } from '@/lib/api-response'
import { handleRoute } from '@/lib/route-handler'

export async function GET() {
  return handleRoute(async () =>
    jsonOk({
      name: 'Highway Grill HRMS API',
      version: '2.0',
      runtime: 'nextjs',
      resources: [
        'auth', 'roles', 'employees', 'users', 'branches', 'departments', 'positions',
        'settings', 'attendance', 'leave', 'payroll', 'shifts', 'dashboard', 'compliance',
        'overtime', 'announcements', 'documents', 'field-work', 'loans', 'geocode', 'notifications',
        'holidays', 'tips', 'contracts', 'benefits',
      ],
    }),
  )
}
