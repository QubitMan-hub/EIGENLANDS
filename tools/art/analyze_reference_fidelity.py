"""Verify the two preserved art packs and make an analytical before/reference/after board.

Does not modify source sheets or shipping assets. Requires Pillow.
Run e2e/reference-fidelity.mjs before/after first to capture the procedural people.
"""
import csv
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / 'art-source/reference-pack'
OUT = ROOT / 'docs/validation/reference-fidelity'


def audit():
    report = []
    with (PACK / 'manifest.csv').open(encoding='utf-8-sig') as manifest:
        for entry in csv.DictReader(manifest):
            path = PACK / entry['Path'].replace('\\', '/')
            if path.suffix != '.png':
                continue
            image = Image.open(path).convert('RGBA')
            alpha = image.getchannel('A').histogram()
            count = image.width * image.height
            report.append({
                'file': path.relative_to(PACK).as_posix(),
                'matchesManifest': hashlib.sha256(path.read_bytes()).hexdigest().upper() == entry['SHA256'],
                'width': image.width, 'height': image.height,
                'transparentFraction': round(alpha[0] / count, 4),
                'partialAlphaFraction': round(sum(alpha[1:255]) / count, 4),
            })
    assert len(report) == 20 and all(row['matchesManifest'] for row in report)
    (OUT / 'source-audit.json').write_text(json.dumps(report, indent=2) + '\n')


def comparison():
    board = Image.new('RGB', (750, 500), (49, 65, 67))
    draw = ImageDraw.Draw(board)
    for col, title in enumerate(['Pack reference (same height)', 'Before', 'Rebuilt']):
        draw.text((col * 250 + 18, 12), title, fill=(244, 226, 191))
    for row, name in enumerate(['male', 'female']):
        source = Image.open(PACK / f'characters/{name}-single-view-actions.png').convert('RGBA')
        # Measured first-hero region; nominal 6×6 cells cut off the first row's boots.
        source = source.crop((0, 0, 209, 235))
        source.putalpha(source.getchannel('A').point(lambda a: 255 if a >= 220 else 0))
        source = source.crop(source.getbbox())
        source = source.resize((round(source.width * 44 / source.height) * 4, 176), Image.Resampling.NEAREST)
        board.paste(source, ((250 - source.width) // 2, 58 + row * 225), source)
        for col, (phase, height) in enumerate([('before', 48), ('after', 56)], 1):
            frame = Image.open(OUT / f'{phase}-characters.png').convert('RGBA')
            frame = frame.crop((0, row * height * 3, 144, (row + 1) * height * 3))
            frame = frame.resize((192, height * 4), Image.Resampling.NEAREST)
            board.paste(frame, (col * 250 + 29, 58 + row * 225 - (height - 48) * 4), frame)
        draw.text((18, 245 + row * 225), name.title(), fill=(244, 226, 191))
    board.save(OUT / 'comparison.png')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    audit()
    comparison()
    print('Verified 20 source PNGs and rebuilt the comparison board')
