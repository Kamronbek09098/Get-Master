import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const profile: { data: { verification: string } | undefined } = { data: undefined };
vi.mock('@/features/master/hooks/useMaster', () => ({ useMyMasterProfile: () => profile }));

import { VerificationBanner } from './VerificationBanner';

function renderBanner() {
  return render(
    <MemoryRouter>
      <VerificationBanner />
    </MemoryRouter>,
  );
}

describe('VerificationBanner', () => {
  beforeEach(() => {
    profile.data = undefined;
  });

  it('tells an unverified master to get verified, with a link to the document section', () => {
    profile.data = { verification: 'PENDING' };
    renderBanner();
    expect(screen.getByText('Profilingiz hali tasdiqlanmagan')).toBeInTheDocument();
    expect(screen.getByText(/faollashtirib bo‘lmaydi/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hujjat yuborish/ })).toHaveAttribute('href', '/ustalar/profil#tasdiqlash');
  });

  it('says documents are being reviewed, without asking for another upload', () => {
    profile.data = { verification: 'UNDER_REVIEW' };
    renderBanner();
    expect(screen.getByText('Hujjatlaringiz ko‘rib chiqilmoqda')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('asks to resubmit after a correction request, a rejection or an expiry', () => {
    for (const verification of ['CORRECTION_REQUESTED', 'REJECTED', 'EXPIRED']) {
      profile.data = { verification };
      const { unmount } = renderBanner();
      expect(screen.getByRole('link', { name: /yuborish/ })).toBeInTheDocument();
      unmount();
    }
  });

  it('shows nothing for a verified master or while the profile is unknown', () => {
    profile.data = { verification: 'VERIFIED' };
    const { container, unmount } = renderBanner();
    expect(container).toBeEmptyDOMElement();
    unmount();
    profile.data = undefined;
    expect(renderBanner().container).toBeEmptyDOMElement();
  });
});
