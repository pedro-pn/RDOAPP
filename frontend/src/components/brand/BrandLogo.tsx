import type { ImgHTMLAttributes } from 'react';

import { useTheme } from '../../theme/useTheme';
import './BrandLogo.css';

const assetsBaseUrl = (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(
  /\/$/,
  ''
);

function brandAsset(filename: string) {
  return `${assetsBaseUrl}/assets/Logo/${filename}`;
}

const BRAND_LOGO_ASSETS = {
  color: { src: brandAsset('LOGO_COLORIDO.png'), width: 3505, height: 943 },
  header: { src: brandAsset('LOGO_HEADER.png'), width: 3519, height: 1065 },
  white: { src: brandAsset('LOGO_BRANCA.png'), width: 3514, height: 974 },
  login: { src: brandAsset('LOGO_LOGIN.png'), width: 2756, height: 1978 },
  symbol: { src: brandAsset('LOGO_TAB.png'), width: 2011, height: 2028 },
  green: { src: brandAsset('LOGO_VERDE.png'), width: 4501, height: 1240 }
} as const;

export type BrandLogoVariant = 'adaptive' | keyof typeof BRAND_LOGO_ASSETS;

export interface BrandLogoProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'alt' | 'height' | 'src' | 'width'
> {
  variant?: BrandLogoVariant;
  alt?: string;
  decorative?: boolean;
}

export function BrandLogo({
  variant = 'adaptive',
  alt = 'Filtrovali',
  decorative = false,
  className,
  loading = 'eager',
  ...props
}: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const resolvedVariant =
    variant === 'adaptive'
      ? resolvedTheme === 'dark'
        ? 'white'
        : 'color'
      : variant;
  const asset = BRAND_LOGO_ASSETS[resolvedVariant];

  return (
    <img
      {...props}
      className={['fv-brand-logo', className].filter(Boolean).join(' ')}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      data-brand-variant={resolvedVariant}
      decoding="async"
      loading={loading}
    />
  );
}
