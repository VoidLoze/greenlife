#!/usr/bin/env python3
"""Builds seed/products.json (structured catalog) from the legacy flat catalog export.

Usage: python3 scripts/build_seed.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "seed"
RAW = SEED / "products.raw.json"
OUT = SEED / "products.json"

CATEGORIES = [
    {"slug": "laundry", "nameRu": "Стирка и уход за одеждой", "nameKk": "Кір жуу және киім күтімі", "icon": "laundry"},
    {"slug": "dishes", "nameRu": "Посуда и кухня", "nameKk": "Ыдыс-аяқ және ас үй", "icon": "dishes"},
    {"slug": "cleaning", "nameRu": "Уборка дома", "nameKk": "Үй тазалау", "icon": "cleaning"},
    {"slug": "home-fragrance", "nameRu": "Освежители и ароматы для дома", "nameKk": "Үйге арналған хош иістер", "icon": "fragrance"},
    {"slug": "pest-control", "nameRu": "Защита от насекомых", "nameKk": "Жәндіктерден қорғау", "icon": "pest"},
    {"slug": "household", "nameRu": "Хозяйственные товары", "nameKk": "Шаруашылық тауарлары", "icon": "household"},
    {"slug": "hair-care", "nameRu": "Уход за волосами", "nameKk": "Шаш күтімі", "icon": "hair"},
    {"slug": "body-care", "nameRu": "Уход за телом и гигиена", "nameKk": "Дене күтімі және гигиена", "icon": "body"},
    {"slug": "face-care", "nameRu": "Уход за лицом", "nameKk": "Бет күтімі", "icon": "face"},
    {"slug": "makeup", "nameRu": "Макияж и парфюмерия", "nameKk": "Макияж және парфюмерия", "icon": "beauty"},
    {"slug": "oral-care", "nameRu": "Уход за полостью рта", "nameKk": "Ауыз қуысын күту", "icon": "oral"},
    {"slug": "kids", "nameRu": "Детские товары", "nameKk": "Балалар тауарлары", "icon": "kids"},
    {"slug": "wellness", "nameRu": "Пластыри, бальзамы и компрессы", "nameKk": "Пластырьлер, бальзамдар және компресстер", "icon": "wellness"},
    {"slug": "nutrition", "nameRu": "Здоровое питание и БАДы", "nameKk": "Салауатты тамақтану және ББҚ", "icon": "health"},
]

# The legacy export grouped products by catalog page, not by purpose, so every product is placed explicitly.
CATEGORY_SKUS = {
    "laundry": "1001-1006 1011 1015 1018 1020 1025 1026 1034 1050 1051 1058 1059 1060 1064 1065",
    "dishes": "1007-1010 1012 1029 1030 1031 1032 1033 1037 1042 1044 1045 1046 1063 1066",
    "cleaning": "1016 1017 1019 1021 1022 1023 1024 1027 1028 1048 1049 1061",
    "home-fragrance": "1047 1067 1068 1069",
    "pest-control": "1035 1036 1070 1071 1072 1197 1198",
    "household": "1038 1039 1040 1041 1052 1054 1055 1056 1057",
    "hair-care": "1073-1086 1087 1088-1096 1097 1098-1101 1102",
    "body-care": "1013 1014 1043 1053 1062 1103 1104 1161 1162 1166 1168 1169 1170 1171 1172 1173 1174 1175 1176 1177 "
                 "1178 1179 1180 1181 1182 1183 1184 1185 1186 1191 1192 1193 1194 1195 1196",
    "face-care": "1167 1202 1205 1211 1212 1213 1214 1215 1216 1217 1218 1219",
    "makeup": "1203 1204 1206 1207 1208 1209 1210",
    "oral-care": "1154 1199 1200 1201",
    "kids": "1133-1153 1155-1160 1163 1164 1165",
    "wellness": "1105 1107 1108 1109 1187 1188 1189 1190",
    "nutrition": "1106 1110-1132",
}


def _expand(spec: str) -> list[str]:
    skus = []
    for part in spec.split():
        start, _, end = part.partition("-")
        for n in range(int(start), int(end or start) + 1):
            skus.append(f"GL-{n}")
    return skus


CATEGORY_BY_SKU = {sku: slug for slug, spec in CATEGORY_SKUS.items() for sku in _expand(spec)}

# Product types (sub-categories) — the second level of catalog filters. Every SKU of a category belongs to exactly one type.
TYPES = {
    "laundry": [
        ("laundry-gels", "Гели и капсулы для стирки", "Кір жууға арналған гельдер мен капсулалар", "1001-1006 1015 1018 1050"),
        ("laundry-powders", "Порошки и соль для стирки", "Кір жуу ұнтақтары мен тұзы", "1020 1064 1065"),
        ("stain-removers", "Пятновыводители и мыло", "Дақ кетіргіштер мен сабын", "1034 1051"),
        ("washer-care", "Уход за стиральной машиной", "Кір жуғыш машина күтімі", "1025 1026"),
        ("clothes-fresh", "Ароматы и свежесть для одежды", "Киімге арналған хош иістер", "1011 1058-1060"),
    ],
    "dishes": [
        ("dish-detergents", "Средства для мытья посуды", "Ыдыс жуу құралдары", "1007-1010 1012 1031"),
        ("degreasers", "От жира и нагара", "Май мен күйе кетіргіштер", "1029 1030 1032 1046"),
        ("descalers", "От накипи и чайного налёта", "Қақ пен шай дағын кетіргіштер", "1033 1045 1066"),
        ("kitchen-accessories", "Губки, салфетки и аксессуары", "Губкалар, сулықтар және керек-жарақтар", "1037 1042 1044 1063"),
    ],
    "cleaning": [
        ("floor-care", "Для пола", "Еденге арналған", "1021 1022"),
        ("bathroom", "Ванная и туалет", "Жуынатын бөлме мен дәретхана", "1017 1024 1027 1049"),
        ("drains", "Для труб и слива", "Құбырларға арналған", "1016 1028"),
        ("universal-cleaners", "Стёкла и универсальные средства", "Әйнек пен әмбебап құралдар", "1019 1023 1048 1061"),
    ],
    "home-fragrance": [
        ("fragrance-beads", "Ароматические шарики", "Хош иісті шарлар", "1067-1069"),
        ("fragrance-water", "Ароматическая вода", "Хош иісті су", "1047"),
    ],
    "pest-control": [
        ("cockroach", "От тараканов", "Тарақандарға қарсы", "1035 1036"),
        ("insect-aerosols", "Аэрозоли от насекомых", "Жәндіктерге қарсы аэрозольдер", "1070 1071"),
        ("mosquito", "От комаров", "Масаларға қарсы", "1197 1198"),
        ("ticks", "От клещей", "Кенелерге қарсы", "1072"),
    ],
    "household": [
        ("sponges", "Губки", "Губкалар", "1038 1039"),
        ("wipes-towels", "Салфетки, полотенца и тряпки", "Сулықтар, сүлгілер мен шүберектер", "1040 1041 1052 1055 1056"),
        ("trash-bags", "Пакеты для мусора", "Қоқыс пакеттері", "1054 1057"),
    ],
    "hair-care": [
        ("shampoos", "Шампуни", "Сусабындар", "1074 1076 1079 1080 1082 1083 1085 1086 1088 1091-1095 1098 1099"),
        ("conditioners", "Бальзамы и кондиционеры", "Бальзамдар мен кондиционерлер", "1073 1075 1081 1084 1089 1097"),
        ("hair-masks", "Маски для волос", "Шаш маскалары", "1077 1090 1102"),
        ("hair-oils", "Масла для волос", "Шаш майлары", "1078 1087 1101"),
        ("hair-treatment", "Спреи и средства против выпадения", "Спрейлер және шаш түсуге қарсы құралдар", "1096 1100"),
    ],
    "body-care": [
        ("shower-gels", "Гели и муссы для душа", "Душқа арналған гельдер мен мусстар", "1103 1175-1177 1182-1186 1196"),
        ("soap", "Мыло", "Сабын", "1043 1053 1178-1181"),
        ("hand-care", "Для рук", "Қол күтімі", "1013 1014 1161 1162 1191"),
        ("body-lotions", "Кремы, лосьоны и гели для тела", "Денеге арналған кремдер, лосьондар және гельдер", "1166 1168-1174"),
        ("deodorants", "Дезодоранты и освежающие средства", "Дезодоранттар мен сергітетін құралдар", "1062 1104 1192"),
        ("pads", "Гигиенические прокладки", "Гигиеналық төсемдер", "1193-1195"),
    ],
    "face-care": [
        ("face-cleansing", "Очищение и снятие макияжа", "Тазарту және макияжды кетіру", "1211-1213 1217 1218"),
        ("face-creams", "Кремы и солнцезащита", "Кремдер және күннен қорғау", "1167 1214 1215"),
        ("face-serums", "Сыворотки и масла", "Сарысулар мен майлар", "1216 1219"),
        ("lip-care", "Уход за губами", "Ерін күтімі", "1202 1205"),
    ],
    "makeup": [
        ("decorative", "Декоративная косметика", "Сәндік косметика", "1203 1204 1206 1207"),
        ("solid-perfume", "Твёрдые духи", "Қатты әтірлер", "1208-1210"),
    ],
    "oral-care": [
        ("toothpaste", "Зубные пасты", "Тіс пасталары", "1199-1201"),
        ("toothbrushes", "Зубные щётки", "Тіс щеткалары", "1154"),
    ],
    "kids": [
        ("kids-bath", "Шампуни и гели для купания", "Шомылуға арналған сусабындар мен гельдер", "1137-1141"),
        ("kids-creams", "Кремы и лосьоны", "Кремдер мен лосьондар", "1133-1136"),
        ("kids-toothpaste", "Зубные пасты", "Тіс пасталары", "1142-1147"),
        ("kids-toothbrushes", "Зубные щётки", "Тіс щеткалары", "1155-1158"),
        ("kids-wipes", "Влажные и бумажные салфетки", "Ылғал және қағаз сулықтар", "1148-1153 1159 1163"),
        ("diapers", "Подгузники", "Жөргектер", "1164 1165"),
        ("kids-laundry", "Стирка детских вещей", "Балалар киімін жуу", "1160"),
    ],
    "wellness": [
        ("patches", "Пластыри", "Пластырьлер", "1105 1107 1189"),
        ("compresses", "Компрессы", "Компресстер", "1108 1188"),
        ("balms", "Бальзамы, гели и кремы", "Бальзамдар, гельдер және кремдер", "1109 1187 1190"),
    ],
    "nutrition": [
        ("supplements", "Капсулы и таблетки", "Капсулалар мен таблеткалар", "1110 1112-1114 1124-1126 1128-1131"),
        ("functional-drinks", "Напитки и желе", "Сусындар мен желе", "1115 1118 1120 1122"),
        ("powders-probiotics", "Порошки, протеин и пробиотики", "Ұнтақтар, протеин және пробиотиктер", "1116 1117 1119 1123 1127"),
        ("tea-coffee", "Чай и кофе", "Шай мен кофе", "1106 1111 1121 1132"),
    ],
}

TYPE_BY_SKU = {sku: slug for types in TYPES.values() for slug, _, _, spec in types for sku in _expand(spec)}


def _validate_types() -> None:
    for category, types in TYPES.items():
        expected = {sku for sku, cat in CATEGORY_BY_SKU.items() if cat == category}
        assigned = [sku for _, _, _, spec in types for sku in _expand(spec)]
        if len(assigned) != len(set(assigned)) or set(assigned) != expected:
            missing = sorted(expected - set(assigned))
            extra = sorted(set(assigned) - expected)
            raise SystemExit(f"Types of '{category}' do not cover the category: missing={missing} extra={extra}")


def categories_with_types() -> list[dict]:
    return [
        {**c, "types": [{"slug": s, "nameRu": ru, "nameKk": kk} for s, ru, kk, _ in TYPES.get(c["slug"], [])]}
        for c in CATEGORIES
    ]

BRANDS = [
    ("iLiFE", r"^(ilife)\b"),
    ("CARICH", r"^(carich|carichcool)"),
    ("Nilrich", r"^(nilrich)\b"),
    ("YIBEILE", r"^(yibeile)\b"),
    ("SEALUXE", r"^(sealuxe)\b"),
    ("KARDLI", r"^(kardli)\b"),
    ("BLUE POINT", r"^(blue point)\b"),
    ("PINK POINT", r"^(pink point)\b"),
    ("ZHENXI", r"^(zhenxi)\b"),
    ("JING", r"^(jing)\b"),
    ("Greenleaf", r"^(greenleaf)\b"),
]

VOLUME_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(кг|мл|г|л)\.?(?![а-яё])", re.IGNORECASE)
SENTENCE_SPLIT_RE = re.compile(r"(?<=[а-яёa-zA-Z0-9%)»\".!°])\s+(?=[А-ЯЁ][а-яё])|\s+(?=⚠)")

USAGE_PREFIXES = ("применение:", "способ применения:", "рекомендация.", "рекомендация:")
COMPOSITION_PREFIXES = ("состав:", "основные ингредиенты:", "активные ингредиенты:", "ингредиенты:")
WARNING_PREFIXES = ("⚠", "внимание:", "не использовать", "не смывать", "не подходит")


def detect_brand(title: str) -> tuple[str, str]:
    lowered = title.strip().lower()
    for brand, pattern in BRANDS:
        match = re.match(pattern, lowered)
        if match:
            rest = title.strip()[match.end():].strip(" -–,")
            return brand, rest
    return "Greenleaf", title.strip()


def detect_volume(raw_weight, title: str) -> str | None:
    if raw_weight and not re.search(r"шт", raw_weight):
        return normalize_volume(raw_weight)
    match = VOLUME_RE.search(title)
    if match:
        return normalize_volume(f"{match.group(1)} {match.group(2)}")
    return None


def normalize_volume(value: str) -> str:
    value = value.strip().rstrip(".")
    value = re.sub(r"(\d)\s*(кг|мл|г|л|шт)", r"\1 \2", value, flags=re.IGNORECASE)
    return value


def clean_name(title: str) -> str:
    name = re.sub(r"\s+", " ", title).strip().rstrip(",")
    name = name.replace("- ", "-") if re.search(r"\w- \w", name) else name
    if name and re.match(r"[а-яё]", name[0]):
        name = name[0].upper() + name[1:]
    return name


def split_description(description: str) -> dict:
    text = re.sub(r"\s+", " ", description or "").strip()
    sentences = [s.strip(" .") for s in SENTENCE_SPLIT_RE.split(text) if s.strip(" .")]
    benefits, usage, composition, warnings = [], [], [], []
    for sentence in sentences:
        lowered = sentence.lower()
        if lowered.startswith(USAGE_PREFIXES):
            usage.append(sentence.split(":", 1)[-1].strip() if ":" in sentence else sentence)
        elif lowered.startswith(COMPOSITION_PREFIXES):
            composition.append(sentence.split(":", 1)[-1].strip())
        elif lowered.startswith(WARNING_PREFIXES):
            warnings.append(sentence.lstrip("⚠ ").split(":", 1)[-1].strip() if ":" in sentence else sentence.lstrip("⚠ "))
        else:
            benefits.append(sentence)
    return {
        "benefits": benefits[:12],
        "usage": ". ".join(usage) or None,
        "composition": ". ".join(composition) or None,
        "warnings": ". ".join(warnings) or None,
    }


def extract_attributes(title: str, description: str, volume: str | None) -> list[dict]:
    attrs = []
    if volume:
        attrs.append({"name": "Объём / вес", "value": volume})
    pieces = re.search(r"\((\d+)\s*шт\.?\)|(\d+)\s*шт\b", title)
    if pieces:
        attrs.append({"name": "Количество в упаковке", "value": f"{pieces.group(1) or pieces.group(2)} шт."})
    age = re.search(r"(?:для детей|от)\s*(\d+(?:\s*[-–]\s*\d+)?)\s*лет", description, re.IGNORECASE)
    if age:
        attrs.append({"name": "Возраст", "value": f"{age.group(1).replace(' ', '')} лет"})
    size = re.search(r"Размер[ыа]?:\s*([^.]+?)(?=\s+[А-ЯЁ][а-яё]|$|\.)", description)
    if size:
        attrs.append({"name": "Размер", "value": size.group(1).strip()})
    shelf = re.search(r"срок годности\s*[–-]\s*([^.]+)", description, re.IGNORECASE)
    if shelf:
        attrs.append({"name": "Срок годности", "value": shelf.group(1).strip()})
    return attrs


def summary_from(benefits: list[str], description: str) -> str:
    source = ". ".join(benefits[:2]) if benefits else description
    source = source.strip()
    if len(source) <= 160:
        return source + ("." if source and not source.endswith(".") else "")
    cut = source[:157].rsplit(" ", 1)[0]
    return cut + "…"


def main() -> None:
    _validate_types()
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    screenshots = {int(p.stem.split("_")[1]) for p in (SEED / "screenshots").glob("page_*.png")}
    products = []
    seen_skus = set()
    for index, item in enumerate(raw):
        title = clean_name(item.get("title") or "")
        brand, _ = detect_brand(title)
        volume = detect_volume(item.get("weight"), title)
        parts = split_description(item.get("description") or "")
        sku = f"GL-{item['id']}"
        if sku in seen_skus:
            sku = f"{sku}-{index}"
        seen_skus.add(sku)
        page = item.get("source_page")
        price = item.get("price")
        products.append({
            "sku": sku,
            "name": title,
            "brand": brand,
            "category": CATEGORY_BY_SKU.get(sku, "household"),
            "type": TYPE_BY_SKU.get(sku),
            "price": price,
            "currency": item.get("currency") or "KZT",
            "volume": volume,
            "summary": summary_from(parts["benefits"], item.get("description") or ""),
            "description": re.sub(r"\s+", " ", item.get("description") or "").strip(),
            "benefits": parts["benefits"],
            "usage": parts["usage"],
            "composition": parts["composition"],
            "warnings": parts["warnings"],
            "attributes": extract_attributes(title, item.get("description") or "", volume),
            "image": item.get("image"),
            "catalogPage": page,
            "screenshot": f"page_{page}.png" if page in screenshots else None,
            "status": "PUBLISHED" if price else "DRAFT",
            "featured": index % 17 == 0,
        })
    OUT.write_text(
        json.dumps({"categories": categories_with_types(), "products": products}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    published = sum(1 for p in products if p["status"] == "PUBLISHED")
    with_shots = sum(1 for p in products if p["screenshot"])
    print(f"Wrote {len(products)} products ({published} published, {with_shots} with catalog screenshots) -> {OUT}")


if __name__ == "__main__":
    main()
