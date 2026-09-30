import { cloneElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

type FieldsetFieldProps = {
  readonly legend: ReactNode;
  readonly inputId: string;
  readonly error?: string;
  readonly describedBy?: string;
  readonly children: ReactElement<{
    id?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
};

export function FieldsetField({
  legend,
  inputId,
  error,
  describedBy,
  children,
}: FieldsetFieldProps) {
  const legendId = useId();
  const errorId = useId();

  const ariaDescribedBy =
    [describedBy, error !== undefined ? errorId : undefined]
      .filter((value): value is string => value !== undefined && value !== '')
      .join(' ') || undefined;

  const clonedChild = cloneElement(children, {
    id: inputId,
    'aria-labelledby': legendId,
    ...(ariaDescribedBy !== undefined && { 'aria-describedby': ariaDescribedBy }),
    ...(error !== undefined && { 'aria-invalid': true }),
  });

  return (
    <fieldset className="fieldset-field">
      <legend id={legendId}>{legend}</legend>
      {clonedChild}
      {error !== undefined && (
        <p id={errorId} className="fieldset-field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
