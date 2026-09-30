import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { PurgeDialog } from '../../src/components/PurgeDialog';
import { ApiError, NetworkError } from '../../src/api/scores';

type HarnessProps = {
  readonly onPurge?: () => Promise<{ readonly deleted: number }>;
  readonly onSuccess?: (result: { readonly deleted: number }) => void;
  readonly initiallyOpen?: boolean;
};

function Harness({
  onPurge = vi.fn().mockResolvedValue({ deleted: 0 }),
  onSuccess = vi.fn(),
  initiallyOpen = true,
}: HarnessProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)}>
        Clear leaderboard
      </button>
      <PurgeDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        onPurge={onPurge}
        onSuccess={onSuccess}
      />
    </div>
  );
}

describe('PurgeDialog', () => {
  afterEach(() => {
    cleanup();
  });

  const typeConfirmation = (value: string) => {
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), { target: { value } });
  };

  const confirmButton = () => screen.getByRole('button', { name: /Clear all scores/i });
  const cancelButton = () => screen.getByRole('button', { name: /Cancel/i });

  it('opens with the confirm button disabled', () => {
    render(<Harness />);
    expect(confirmButton()).toBeDisabled();
  });

  it.each([
    { value: '', description: 'an empty value' },
    { value: 'delete', description: 'lowercase delete' },
    { value: ' DELETE ', description: 'a value surrounded by spaces' },
    { value: 'REMOVE', description: 'a different word' },
  ])('keeps the confirm button disabled for $description', ({ value }) => {
    render(<Harness />);
    typeConfirmation(value);
    expect(confirmButton()).toBeDisabled();
  });

  it('enables the confirm button only for the exact DELETE value', () => {
    render(<Harness />);
    typeConfirmation('DELETE');
    expect(confirmButton()).toBeEnabled();
  });

  it('explains the mismatch instead of leaving a blocked click unexplained', () => {
    render(<Harness />);

    // Nothing to explain before anything is typed.
    expect(screen.queryByText(/It must be exactly/i)).not.toBeInTheDocument();

    typeConfirmation('delete');

    expect(screen.getByText(/It must be exactly/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type DELETE to confirm/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(/Type DELETE to confirm/i)).toHaveAccessibleDescription(
      /It must be exactly/i,
    );
  });

  it('withdraws the hint once the value matches exactly', () => {
    render(<Harness />);

    typeConfirmation('delete');
    expect(screen.getByText(/It must be exactly/i)).toBeInTheDocument();

    typeConfirmation('DELETE');

    expect(screen.queryByText(/It must be exactly/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Type DELETE to confirm/i)).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });

  it('does not call onPurge when cancelled', () => {
    const onPurge = vi.fn().mockResolvedValue({ deleted: 0 });
    render(<Harness onPurge={onPurge} />);

    typeConfirmation('DELETE');
    fireEvent.click(cancelButton());

    expect(onPurge).not.toHaveBeenCalled();
  });

  it('calls onPurge when confirmed with DELETE', async () => {
    const onPurge = vi.fn().mockResolvedValue({ deleted: 2 });
    render(<Harness onPurge={onPurge} />);

    typeConfirmation('DELETE');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onPurge).toHaveBeenCalledTimes(1));
  });

  it('closes and reports success when the purge succeeds', async () => {
    const onPurge = vi.fn().mockResolvedValue({ deleted: 3 });
    const onSuccess = vi.fn();
    render(<Harness onPurge={onPurge} onSuccess={onSuccess} />);

    typeConfirmation('DELETE');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSuccess).toHaveBeenCalledWith({ deleted: 3 });
  });

  it('keeps the dialog open and shows the API error when the purge fails', async () => {
    const onPurge = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Invalid', []));
    render(<Harness onPurge={onPurge} />);

    typeConfirmation('DELETE');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Invalid/i)).toBeInTheDocument();
  });

  it('shows a network error when the request never completes', async () => {
    const onPurge = vi
      .fn()
      .mockRejectedValue(
        new NetworkError('The purge request could not reach the server.', new TypeError('failed')),
      );
    render(<Harness onPurge={onPurge} />);

    typeConfirmation('DELETE');
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(screen.getByText(/Could not connect to the ranking server/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
