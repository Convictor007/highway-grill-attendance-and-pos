import type { BenefitsTab } from '../../types/hrms'
type TabDef = { id: BenefitsTab; label: string }

type Props = {
  active: BenefitsTab
  onChange: (tab: BenefitsTab) => void
  tabs: TabDef[]
}

export function BenefitsTabNav({ active, onChange, tabs }: Props) {
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
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
      <div className="tabs tabs--benefits mobile-hidden" role="tablist" aria-label="Benefits sections">
        {tabs.map((tab) => (
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
