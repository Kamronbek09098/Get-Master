import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramAlertService } from './telegram-alert.service';

function service(values: Record<string, unknown>) {
  const config = { get: (key: string, fallback?: unknown) => values[key] ?? fallback };
  const instance = new TelegramAlertService(config as never);
  instance.onModuleInit();
  return instance;
}

afterEach(() => vi.unstubAllGlobals());

describe('registration notice', () => {
  it('sends only phone and name — the method cannot even receive a password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.otpChatId': '-1', 'app.name': 'GetMaster' });
    telegram.notifyRegistration({ phone: '+998901234567', name: 'Ali <Valiyev>' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body.chat_id).toBe('-1');
    expect(body.text).toContain('+998901234567');
    expect(body.text).toContain('Ali &lt;Valiyev&gt;');
    expect(body.text.toLowerCase()).not.toContain('parol');
  });

  it('does nothing when Telegram is not configured', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service({}).notifyRegistration({ phone: '+998901234567', name: 'Ali' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
