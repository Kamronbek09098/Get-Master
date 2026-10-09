#!/usr/bin/env python3
"""
Navigatsiya ovozli ko‘rsatmalarini (o‘zbekcha) tayyorlaydi: apps/web/public/voice/uz/*.mp3.
Microsoft Edge neyron ovozi (uz-UZ) ishlatiladi; fayllar ilovaga qo‘shib beriladi, shuning uchun internetsiz ham ishlaydi.

Ishga tushirish:  python3 -m venv /tmp/tts && /tmp/tts/bin/pip install edge-tts && /tmp/tts/bin/python scripts/generate-nav-voice.py [Sardor|Madina]
"""
import asyncio, sys, pathlib
import edge_tts

VOICE = 'uz-UZ-' + (sys.argv[1] if len(sys.argv) > 1 else 'Sardor') + 'Neural'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'apps/web/public/voice/uz'
OUT.mkdir(parents=True, exist_ok=True)

MANEUVERS = {
    'left': 'Chapga buriling',
    'right': 'O‘ngga buriling',
    'slight-left': 'Biroz chapga oling',
    'slight-right': 'Biroz o‘ngga oling',
    'sharp-left': 'Keskin chapga buriling',
    'sharp-right': 'Keskin o‘ngga buriling',
    'uturn': 'Imkon bo‘lsa, qayrilib oling',
    'roundabout': 'Aylanma yo‘lga kiring',
    'straight': 'To‘g‘ri davom eting',
    'arrive': 'Manzilga yetib keldingiz',
    'depart': 'Yo‘lni boshlang',
}
EVENTS = {
    'route-ready': 'Marshrut tayyor',
    'reroute': 'Yo‘ldan chiqdingiz. Marshrut qayta hisoblanmoqda',
    'reroute-done': 'Yangi marshrut tayyor',
    'destination-right': 'Manzil o‘ng tomonda',
    'destination-left': 'Manzil chap tomonda',
    'near-destination': 'Manzilga yaqinlashmoqdasiz',
}
# Masofa: metr bo‘yicha «... dan keyin»
DIST = {
    50: 'Ellik metrdan keyin', 100: 'Yuz metrdan keyin', 150: 'Bir yuz ellik metrdan keyin', 200: 'Ikki yuz metrdan keyin',
    300: 'Uch yuz metrdan keyin', 400: 'To‘rt yuz metrdan keyin', 500: 'Besh yuz metrdan keyin', 700: 'Yetti yuz metrdan keyin',
    1000: 'Bir kilometrdan keyin', 2000: 'Ikki kilometrdan keyin', 3000: 'Uch kilometrdan keyin', 5000: 'Besh kilometrdan keyin',
}

async def make(name: str, text: str):
    path = OUT / f'{name}.mp3'
    await edge_tts.Communicate(text, VOICE, rate='+4%').save(str(path))
    print(f'{path.name}: {path.stat().st_size // 1024} KB — {text}')

async def main():
    jobs = [make(f'm-{k}', v) for k, v in MANEUVERS.items()]
    jobs += [make(f'e-{k}', v) for k, v in EVENTS.items()]
    jobs += [make(f'd-{k}', v) for k, v in DIST.items()]
    for i in range(0, len(jobs), 6):
        await asyncio.gather(*jobs[i:i + 6])

asyncio.run(main())
