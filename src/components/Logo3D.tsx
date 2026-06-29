import hgLogo from '../assets/HG_logo.png'

type Props = {
  /** Rendered diameter in pixels. */
  size?: number
  /** Number of stacked layers used to fake the extruded depth. */
  depth?: number
  /** Seconds for one full rotation. */
  speed?: number
  className?: string
}

/**
 * A real CSS-3D logo: copies of the logo are stacked along the Z axis to
 * give it physical thickness, then the whole stack spins in 3D space.
 * No external libraries, no network calls — works fully offline.
 */
export function Logo3D({ size = 120, depth = 14, speed = 9, className = '' }: Props) {
  const layers = Array.from({ length: depth })
  // Center the stack so it rotates around its own thickness.
  const half = (depth - 1) / 2

  return (
    <div
      className={`logo3d-scene${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      <div className="logo3d" style={{ animationDuration: `${speed}s` }}>
        {layers.map((_, i) => {
          const z = (i - half) * 1.4
          // Edge copies are darkened to read as the extruded side.
          const isFace = i === 0 || i === depth - 1
          return (
            <img
              key={i}
              src={hgLogo}
              alt={isFace ? 'Highway Grill' : ''}
              aria-hidden={!isFace}
              className="logo3d-layer"
              style={{
                transform: `translateZ(${z}px)`,
                filter: isFace ? 'none' : `brightness(${0.45 + (i / depth) * 0.1})`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
