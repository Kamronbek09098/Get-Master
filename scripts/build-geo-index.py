#!/usr/bin/env python3
"""OSM (Geofabrik) PBF dan O'zbekiston manzillar indeksini quradi: data/geo-uz.json.

Ishlatish:
  python3 -m venv /tmp/venv && /tmp/venv/bin/pip install osmium
  /tmp/venv/bin/python scripts/build-geo-index.py <uzbekistan-latest.osm.pbf> [data/geo-uz.json]

Backend (GeoService) bu faylni xotiraga yuklab, qidiruvni millisekundlarda bajaradi.
"""
import json
import math
import sys

import osmium

PLACE_RANK = {'city': 100, 'town': 90, 'suburb': 70, 'district': 70, 'village': 60, 'quarter': 50, 'neighbourhood': 50, 'hamlet': 30, 'locality': 20}
BIG_KINDS = {'city', 'town'}
SMALL_KINDS = {'village', 'hamlet'}
CITY_KINDS = BIG_KINDS | SMALL_KINDS
AREA_KINDS = {'suburb', 'district', 'quarter', 'neighbourhood'}
STREET_KINDS = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian', 'road'}
POI_KEYS = ('amenity', 'shop', 'tourism', 'leisure', 'office', 'railway', 'public_transport', 'aeroway', 'building', 'historic', 'man_made')
CELL = 0.05  # ~5 km


def names(tags):
    main = tags.get('name:uz') or tags.get('name') or tags.get('name:ru') or tags.get('name:en')
    if not main:
        return None, ''
    alts = []
    for key in ('name', 'name:uz', 'name:ru', 'name:en', 'name:uz-Cyrl', 'old_name', 'alt_name', 'official_name'):
        value = tags.get(key)
        if value and value != main and value not in alts:
            alts.append(value)
    return main, ' | '.join(alts)


class Collector(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []  # [name, alt, rank, lat, lon, kind, city_hint, district_hint]
        self.places = []  # (lat, lon, kind, name)
        self.street_cells = set()

    def add(self, name, alt, rank, lat, lon, kind, tags):
        city = tags.get('addr:city') or tags.get('addr:place') or ''
        district = tags.get('addr:district') or tags.get('addr:suburb') or ''
        self.rows.append([name, alt, rank, round(lat, 5), round(lon, 5), kind, city, district])

    def node(self, n):
        tags = n.tags
        if not n.location.valid():
            return
        lat, lon = n.location.lat, n.location.lon
        place = tags.get('place')
        main, alt = names(tags)
        if place in PLACE_RANK and main:
            self.places.append((lat, lon, place, main))
            self.add(main, alt, PLACE_RANK[place], lat, lon, place, tags)
            return
        if main and any(key in tags for key in POI_KEYS):
            self.add(main, alt, 20, lat, lon, 'poi', tags)
            return
        street, house = tags.get('addr:street'), tags.get('addr:housenumber')
        if street and house:
            self.add(f'{street}, {house}', '', 10, lat, lon, 'house', tags)

    def way(self, w):
        tags = w.tags
        try:
            nodes = [node for node in w.nodes if node.location.valid()]
        except osmium.InvalidLocationError:
            return
        if not nodes:
            return
        mid = nodes[len(nodes) // 2]
        lat, lon = mid.location.lat, mid.location.lon
        main, alt = names(tags)
        highway = tags.get('highway')
        if main and highway in STREET_KINDS:
            cell = (main.lower(), round(lat / CELL), round(lon / CELL))
            if cell in self.street_cells:
                return
            self.street_cells.add(cell)
            self.add(main, alt, 40, lat, lon, 'street', tags)
        elif main and any(key in tags for key in POI_KEYS):
            self.add(main, alt, 20, lat, lon, 'poi', tags)
        else:
            street, house = tags.get('addr:street'), tags.get('addr:housenumber')
            if street and house:
                self.add(f'{street}, {house}', main or '', 10, lat, lon, 'house', tags)


def build_grid(places, kinds, cell=CELL):
    grid = {}
    for lat, lon, kind, name in places:
        if kind in kinds:
            grid.setdefault((round(lat / cell), round(lon / cell)), []).append((lat, lon, name, PLACE_RANK[kind]))
    return grid


def nearest(grid, lat, lon, cell=CELL):
    gy, gx = round(lat / cell), round(lon / cell)
    best, best_d = None, 1e9
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for plat, plon, name, rank in grid.get((gy + dy, gx + dx), ()):
                d = (plat - lat) ** 2 + ((plon - lon) * math.cos(math.radians(lat))) ** 2
                if d < best_d:
                    best, best_d = name, d
    return best


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'data/geo-uz.json'
    handler = Collector()
    handler.apply_file(src, locations=True)
    big = build_grid(handler.places, BIG_KINDS, 0.25)
    small = build_grid(handler.places, SMALL_KINDS)
    areas = build_grid(handler.places, AREA_KINDS)

    strings, string_ids = [''], {'': 0}

    def sid(value):
        if value not in string_ids:
            string_ids[value] = len(strings)
            strings.append(value)
        return string_ids[value]

    rows = []
    for name, alt, rank, lat, lon, kind, city, district in handler.rows:
        if kind not in CITY_KINDS:
            city = city or nearest(big, lat, lon, 0.25) or nearest(small, lat, lon) or ''
        if kind not in AREA_KINDS and kind not in CITY_KINDS:
            district = district or nearest(areas, lat, lon) or ''
        rows.append([name, alt, rank, lat, lon, sid(city), sid(district)])
    with open(out, 'w', encoding='utf-8') as file:
        json.dump({'strings': strings, 'rows': rows}, file, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} ta yozuv -> {out}')


if __name__ == '__main__':
    main()
