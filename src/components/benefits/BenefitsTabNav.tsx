import type { BenefitsTab } from '../../types/hrms'
import { BENEFITS_TABS } from '../../lib/benefitsUi'

type Props = {
  active: BenefitsTab
  onChange: (tab: BenefitsTab) => void
}

export function BenefitsTabNav({ active, onChange }: Props) {
  return (
    <>
      <div className="benefits-tab-select-wrap desktop-hidden">
        <label className="sr-only" htmlFor="benefits-tab-select">
          Benefits section
        </label>
        <select
          id="benefits-tab-select"
          className="benefits-tab-select"
          value={active}
          onChange={(e) => onChange(e.target.value as BenefitsTab)}
        >
          {BENEFITS_TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
      <div className="tabs tabs--benefits mobile-hidden" role="tablist" aria-label="Benefits sections">
        {BENEFITS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`tab ${active === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  )
}
