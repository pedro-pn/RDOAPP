import type { CSSProperties, HTMLAttributes } from 'react';

import { joinClassNames } from './utils';
import './styles.css';

export type SkeletonVariant =
  'text' | 'block' | 'circle' | 'table-rows' | 'card';

export interface SkeletonProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  label?: string;
  decorative?: boolean;
}

function toDimension(value: string | number | undefined) {
  return typeof value === 'number' ? `${value}px` : value;
}

function SkeletonLine({ index }: { index: number }) {
  return (
    <span
      className="fv-skeleton__shape fv-skeleton__line"
      data-line={index + 1}
    />
  );
}

export function Skeleton({
  variant = 'block',
  width,
  height,
  lines = 3,
  label = 'Carregando…',
  decorative = false,
  className,
  style,
  ...props
}: SkeletonProps) {
  const shapeStyle = {
    ...style,
    '--fv-skeleton-width': toDimension(width),
    '--fv-skeleton-height': toDimension(height)
  } as CSSProperties;
  const count = Math.max(1, Math.floor(lines));

  return (
    <div
      {...props}
      className={joinClassNames(
        'fv-skeleton',
        `fv-skeleton--${variant}`,
        className
      )}
      style={shapeStyle}
      aria-hidden={decorative || undefined}
      aria-busy={decorative ? undefined : 'true'}
      aria-live={decorative ? undefined : 'polite'}
      role={decorative ? undefined : 'status'}
    >
      {!decorative ? <span className="fv-sr-only">{label}</span> : null}
      <div className="fv-skeleton__content" aria-hidden="true">
        {variant === 'text' || variant === 'table-rows' ? (
          Array.from({ length: count }, (_, index) => (
            <SkeletonLine key={index} index={index} />
          ))
        ) : variant === 'card' ? (
          <>
            <span className="fv-skeleton__shape fv-skeleton__card-media" />
            <SkeletonLine index={0} />
            <SkeletonLine index={1} />
            <SkeletonLine index={2} />
          </>
        ) : (
          <span className="fv-skeleton__shape" />
        )}
      </div>
    </div>
  );
}
