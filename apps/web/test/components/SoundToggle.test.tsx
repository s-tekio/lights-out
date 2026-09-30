import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundToggle } from '../../src/components/SoundToggle';

describe('SoundToggle', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders as a real button', () => {
    render(<SoundToggle enabled onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Sound' });
    expect(button).toBeInTheDocument();
  });

  it('reflects the enabled state with aria-pressed', () => {
    const { rerender } = render(<SoundToggle enabled onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    rerender(<SoundToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onToggle when clicked', () => {
    const handleToggle = vi.fn();
    render(<SoundToggle enabled onToggle={handleToggle} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a different icon when disabled', () => {
    const { rerender } = render(<SoundToggle enabled onToggle={vi.fn()} />);
    const enabledHtml = screen.getByRole('button').innerHTML;

    rerender(<SoundToggle enabled={false} onToggle={vi.fn()} />);
    const disabledHtml = screen.getByRole('button').innerHTML;

    expect(disabledHtml).not.toBe(enabledHtml);
  });
});
