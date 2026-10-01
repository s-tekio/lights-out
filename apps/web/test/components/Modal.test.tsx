import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRef, useState } from 'react';
import { Modal } from '../../src/components/Modal';

function TestHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'test-dialog' : undefined}
        onClick={() => setIsOpen(true)}
      >
        Open
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        dialogId="test-dialog"
        titleId="test-dialog-title"
      >
        <h2 id="test-dialog-title">Modal title</h2>
        <input type="text" placeholder="Type here" />
        <button type="button" onClick={() => setIsOpen(false)}>
          Close
        </button>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  afterEach(() => {
    cleanup();
  });

  const openDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: /Open/i }));
  };

  it('is not in the document when closed', () => {
    render(<TestHarness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not steal focus on initial render', () => {
    render(<TestHarness />);
    expect(screen.getByRole('button', { name: /Open/i })).not.toHaveFocus();
  });

  it('opens when the trigger is clicked', () => {
    render(<TestHarness />);
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('moves focus into the dialog on open', () => {
    render(<TestHarness />);
    openDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the trigger on close', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open/i })).toHaveFocus();
  });

  it('closes when Escape is pressed', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', () => {
    render(<TestHarness />);
    openDialog();

    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).toHaveClass('dialog-backdrop');

    if (backdrop === null) {
      throw new Error('Expected the dialog to have a backdrop parent element');
    }

    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and closes without a trigger ref', () => {
    function HarnessWithoutTrigger() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          dialogId="test-dialog"
          titleId="test-dialog-title"
        >
          <h2 id="test-dialog-title">No trigger</h2>
          <button type="button" onClick={() => setIsOpen(false)}>
            Close
          </button>
        </Modal>
      );
    }

    render(<HarnessWithoutTrigger />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies the optional backdrop class name', () => {
    function HarnessWithBackdropClass() {
      return (
        <Modal
          isOpen
          onClose={() => undefined}
          dialogId="test-dialog"
          titleId="test-dialog-title"
          backdropClassName="custom-backdrop"
        >
          <h2 id="test-dialog-title">Titled</h2>
        </Modal>
      );
    }

    render(<HarnessWithBackdropClass />);
    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).toHaveClass('dialog-backdrop', 'custom-backdrop');
  });

  it('does not close when clicking inside the dialog', () => {
    render(<TestHarness />);
    openDialog();

    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('heading', { name: /Modal title/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByPlaceholderText(/Type here/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('wraps Tab from the last focusable element to the first', () => {
    render(<TestHarness />);
    openDialog();

    const closeButton = screen.getByRole('button', { name: /Close/i });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByPlaceholderText(/Type here/i)).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    render(<TestHarness />);
    openDialog();

    const input = screen.getByPlaceholderText(/Type here/i);
    input.focus();
    expect(input).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: /Close/i })).toHaveFocus();
  });
});
