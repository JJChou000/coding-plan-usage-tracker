import { useEffect, useState } from 'react'

export interface ProviderIconProps {
  icon: string
  fallbackIcon: string
  alt: string
  className: string
  imageClassName: string
  size: number
}

function isImageSource(icon: string): boolean {
  return /^(data:image|file:|https?:\/\/|\.{0,2}\/|\/)/.test(icon)
}

function ProviderIcon({
  icon,
  fallbackIcon,
  alt,
  className,
  imageClassName,
  size
}: ProviderIconProps): React.JSX.Element {
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    setHasImageError(false)
  }, [icon])

  if (!icon || hasImageError || !isImageSource(icon)) {
    return (
      <span className={className} aria-hidden="true">
        {fallbackIcon}
      </span>
    )
  }

  return (
    <span className={className} aria-hidden="true">
      <img
        className={imageClassName}
        src={icon}
        alt={alt}
        width={size}
        height={size}
        onError={() => setHasImageError(true)}
      />
    </span>
  )
}

export default ProviderIcon
