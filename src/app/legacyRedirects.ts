/** Old bookmark URLs → canonical routes. Keep in sync when renaming paths. */
export const LEGACY_REDIRECTS: ReadonlyArray<{ path: string; to: string }> = [
  { path: 'overtime', to: '/dtr' },
  { path: 'benefits', to: '/payroll' },
  { path: 'documents', to: '/service-records' },
  { path: 'field-work', to: '/' },
  { path: 'leave', to: '/leaves' },
  { path: 'my-shifts', to: '/scheduling' },
  { path: 'my-payslips', to: '/payroll' },
  { path: 'hr/overtime', to: '/hr/attendance-stats' },
  { path: 'admin/field-work', to: '/admin' },
  { path: 'settings', to: '/admin/settings' },
  { path: 'compliance', to: '/admin/compliance' },
]
