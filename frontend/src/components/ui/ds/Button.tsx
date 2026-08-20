import type { ButtonHTMLAttributes, ForwardedRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';

import { AppIcon } from '../../icons/AppIcon';
import { Spinner } from './Spinner';
import type { ControlSize } from './types';
import { joinClassNames } from './utils';
import './styles.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  loadingLabel?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

function ButtonComponent(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    loadingLabel = 'Carregando…',
    iconLeft,
    iconRight,
    fullWidth = false,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={joinClassNames(
        'fv-button',
        `fv-button--${variant}`,
        `fv-button--${size}`,
        fullWidth && 'fv-button--full',
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      <span className="fv-button__icon" aria-hidden="true">
        {loading ? <Spinner size="sm" decorative /> : iconLeft}
      </span>
      <span className="fv-button__label">{children}</span>
      {iconRight ? (
        <span className="fv-button__icon" aria-hidden="true">
          {iconRight}
        </span>
      ) : null}
      {loading ? <span className="fv-sr-only">{loadingLabel}</span> : null}
    </button>
  );
}

export const Button = forwardRef(ButtonComponent);

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
}

function IconButtonComponent(
  {
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    loading = false,
    disabled,
    className,
    type = 'button',
    ...props
  }: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={joinClassNames(
        'fv-button',
        'fv-icon-button',
        `fv-button--${variant}`,
        `fv-button--${size}`,
        className
      )}
      disabled={disabled || loading}
      aria-label={label}
      aria-busy={loading || undefined}
      title={props.title ?? label}
    >
      {loading ? (
        <Spinner size="sm" decorative />
      ) : (
        <AppIcon icon={icon} size={size === 'lg' ? 'md' : 'sm'} />
      )}
    </button>
  );
}

export const IconButton = forwardRef(IconButtonComponent);
