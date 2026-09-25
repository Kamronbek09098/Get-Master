import { describe, expect, it } from 'vitest';
import { deriveVerification } from '../../src/modules/trust/trust.service';

const now = new Date('2026-09-23T12:00:00Z');
const doc = (
  documentType: 'IDENTITY' | 'LICENSE',
  status: 'PENDING' | 'UNDER_REVIEW' | 'CORRECTION_REQUESTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED',
  createdAt: string,
  expiresAt: string | null = null,
) => ({ documentType, status, createdAt: new Date(createdAt), expiresAt: expiresAt ? new Date(expiresAt) : null });

describe('deriveVerification', () => {
  it('is PENDING with no documents', () => {
    expect(deriveVerification([], now)).toBe('PENDING');
  });
  it('needs an approved IDENTITY document to be VERIFIED', () => {
    expect(deriveVerification([doc('LICENSE', 'VERIFIED', '2026-09-01T00:00:00Z')], now)).toBe('PENDING');
    expect(deriveVerification([doc('IDENTITY', 'VERIFIED', '2026-09-01T00:00:00Z')], now)).toBe('VERIFIED');
  });
  it('keeps VERIFIED while a renewal is under review', () => {
    expect(
      deriveVerification(
        [doc('IDENTITY', 'VERIFIED', '2026-09-01T00:00:00Z'), doc('IDENTITY', 'PENDING', '2026-09-22T00:00:00Z')],
        now,
      ),
    ).toBe('VERIFIED');
  });
  it('reports UNDER_REVIEW while something awaits review', () => {
    expect(deriveVerification([doc('IDENTITY', 'PENDING', '2026-09-22T00:00:00Z')], now)).toBe('UNDER_REVIEW');
  });
  it('lets a resubmission supersede an older correction request', () => {
    expect(
      deriveVerification(
        [doc('IDENTITY', 'CORRECTION_REQUESTED', '2026-09-01T00:00:00Z'), doc('IDENTITY', 'PENDING', '2026-09-02T00:00:00Z')],
        now,
      ),
    ).toBe('UNDER_REVIEW');
  });
  it('is EXPIRED when the approved identity lapsed and was superseded by nothing newer', () => {
    expect(
      deriveVerification(
        [
          doc('IDENTITY', 'CORRECTION_REQUESTED', '2026-09-01T00:00:00Z'),
          doc('IDENTITY', 'VERIFIED', '2026-09-02T00:00:00Z', '2026-09-23T11:59:59Z'),
        ],
        now,
      ),
    ).toBe('EXPIRED');
  });
  it('is REJECTED / CORRECTION_REQUESTED from the latest document', () => {
    expect(deriveVerification([doc('IDENTITY', 'REJECTED', '2026-09-01T00:00:00Z')], now)).toBe('REJECTED');
    expect(deriveVerification([doc('IDENTITY', 'CORRECTION_REQUESTED', '2026-09-01T00:00:00Z')], now)).toBe(
      'CORRECTION_REQUESTED',
    );
  });
});
