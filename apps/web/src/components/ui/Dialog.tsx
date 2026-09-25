import type { ReactNode } from 'react';
import { Modal } from './Modal';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={footer}>
      {description && <p style={{ color: 'var(--gm-color-text-muted)', marginBottom: children ? 'var(--gm-space-4)' : 0 }}>{description}</p>}
      {children}
    </Modal>
  );
}
