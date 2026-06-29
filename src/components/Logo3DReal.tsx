import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useTexture } from '@react-three/drei'
import { SRGBColorSpace, type Texture } from 'three'
import hgLogo from '../assets/HG_logo.png'

type Props = {
  /** Rendered square size in pixels. */
  size?: number
  /** Degrees-per-second auto spin. */
  spin?: number
  /** Allow click-drag to orbit the medallion. */
  interactive?: boolean
  className?: string
}

function Medallion({ spin, interactive }: { spin: number; interactive: boolean }) {
  const texture = useTexture(hgLogo) as Texture
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8

  // Cylinder material slots: [side, top, bottom].
  // The logo prints on both flat faces; the rim is brushed metal.
  const materials = useMemo(
    () => [
      { color: '#b5651d', metalness: 0.9, roughness: 0.35 },
      { map: texture, metalness: 0.25, roughness: 0.55 },
      { map: texture, metalness: 0.25, roughness: 0.55 },
    ],
    [texture],
  )

  return (
    <>
      {/* rotate so the circular faces point at the camera */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 0.16, 96]} />
        {materials.map((m, i) => (
          <meshStandardMaterial key={i} attach={`material-${i}`} {...m} />
        ))}
      </mesh>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={interactive}
        autoRotate
        autoRotateSpeed={spin}
      />
    </>
  )
}

/**
 * True three.js-rendered 3D logo medallion: real geometry, lighting,
 * metallic reflections and depth. Auto-spins; optionally drag to orbit.
 * Runs entirely client-side with no network calls.
 */
export function Logo3DReal({ size = 160, spin = 4, interactive = true, className = '' }: Props) {
  return (
    <div
      className={`logo3d-real${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 35 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, -2, 2]} intensity={0.6} color="#ffd9a0" />
        <pointLight position={[0, 0, 4]} intensity={1.4} />
        <Suspense fallback={null}>
          <Medallion spin={spin} interactive={interactive} />
        </Suspense>
      </Canvas>
    </div>
  )
}
