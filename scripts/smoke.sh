#!/usr/bin/env bash
# End-to-end smoke test of the API: auth, roles, cart, checkout, admin product + media, orders.
# Usage: scripts/smoke.sh [base-url] (default http://localhost:8080)
set -uo pipefail

B="${1:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@greenleaf.kz}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin12345}"
SEED_DIR="$(cd "$(dirname "$0")/../seed" && pwd)"
TMP="$(mktemp -d)"
FAILED=0

json() {
  python3 -c "
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
    print($1)
except Exception:
    sys.stderr.write('    response: ' + raw[:300] + '\n')
"
}
check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then echo "  ok   $name"; else echo "  FAIL $name: expected $expected, got $actual"; FAILED=1; fi
}
post() { curl -s -H 'Content-Type: application/json' -X "${3:-POST}" "$B$1" -d "$2" "${@:4}"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== public"
# Actuator is only reachable on the backend itself; behind nginx readiness is checked via the public settings API.
for _ in $(seq 1 30); do
  [[ "$(curl -s "$B/api/settings/public" 2>/dev/null)" == *'"storeName"'* ]] && break
  sleep 2
done
check "api ready" "True" "$(curl -s "$B/api/settings/public" | json "'storeName' in d")"
if [[ "$(curl -s "$B/actuator/health" 2>/dev/null)" == *'"status"'* ]]; then
  check "health" "UP" "$(curl -s "$B/actuator/health" | json "d['status']")"
fi
check "catalog home" "True" "$(curl -s "$B/api/catalog/home" | json "d['productCount'] > 0")"
SLUG=$(curl -s "$B/api/catalog/products?size=1&sort=price_asc" | json "d['items'][0]['slug']")
PID=$(curl -s "$B/api/catalog/products/$SLUG" | json "d['card']['id']")
check "product detail has photos" "True" "$(curl -s "$B/api/catalog/products/$SLUG" | json "len(d['photos']) > 0")"
check "unknown product 404" "404" "$(code "$B/api/catalog/products/no-such-product")"
check "wrong content type 415" "415" "$(code -X POST "$B/api/auth/login" -d 'a=b')"

echo "== auth"
EMAIL="smoke$(date +%s)@mail.kz"
REG=$(post /api/auth/register "{\"email\":\"$EMAIL\",\"password\":\"Secret123\",\"fullName\":\"Smoke Test\",\"phone\":\"+7 701 000 00 01\"}" POST -c "$TMP/user.jar")
UT=$(echo "$REG" | json "d['accessToken']")
check "register normalizes phone" "+77010000001" "$(echo "$REG" | json "d['user']['phone']")"
check "weak password rejected" "400" "$(code -H 'Content-Type: application/json' -X POST "$B/api/auth/register" -d '{"email":"weak@mail.kz","password":"123","fullName":"W"}')"
check "me" "$EMAIL" "$(curl -s -H "Authorization: Bearer $UT" "$B/api/auth/me" | json "d['email']")"
check "user cannot open admin" "403" "$(code -H "Authorization: Bearer $UT" "$B/api/admin/dashboard")"
check "anonymous cannot open admin" "401" "$(code "$B/api/admin/dashboard")"
check "refresh rotates" "200" "$(code -b "$TMP/user.jar" -c "$TMP/user.jar" -X POST "$B/api/auth/refresh")"
check "refresh again" "200" "$(code -b "$TMP/user.jar" -c "$TMP/user.jar" -X POST "$B/api/auth/refresh")"
AT=$(post /api/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | json "d['accessToken']")
check "admin dashboard" "200" "$(code -H "Authorization: Bearer $AT" "$B/api/admin/dashboard")"

echo "== cart & checkout"
QUOTE=$(post /api/cart/quote "{\"items\":[{\"productId\":$PID,\"quantity\":500},{\"productId\":999999,\"quantity\":1}],\"deliveryMethod\":\"DELIVERY\"}")
check "quote clamps quantity" "99" "$(echo "$QUOTE" | json "d['items'][0]['quantity']")"
check "quote warns about unknown product" "True" "$(echo "$QUOTE" | json "any(w['code']=='unavailable' for w in d['warnings'])")"
QUOTE=$(post /api/cart/quote "{\"items\":[{\"productId\":$PID,\"quantity\":1}],\"deliveryMethod\":\"DELIVERY\"}")
TOTAL=$(echo "$QUOTE" | json "d['total']")
check "delivery fee applied below threshold" "True" "$(echo "$QUOTE" | json "d['deliveryFee'] > 0")"
# JSON bodies live in variables: macOS bash 3.2 brace-expands "{a,b}" inside nested "$( ... )".
CART_BODY="{\"items\":[{\"productId\":$PID,\"quantity\":1}]}"
CHECKOUT_BASE="\"customerName\":\"Smoke\",\"phone\":\"87010000001\",\"city\":\"Алматы\",\"address\":\"ул. Абая 1\",\"deliveryMethod\":\"DELIVERY\",\"paymentMethod\":\"KASPI\",\"items\":[{\"productId\":$PID,\"quantity\":1}]"
STALE_CHECKOUT="{$CHECKOUT_BASE,\"expectedTotal\":1}"
GOOD_CHECKOUT="{$CHECKOUT_BASE,\"expectedTotal\":$TOTAL}"
check "server cart saved" "1" "$(post /api/cart "$CART_BODY" PUT -H "Authorization: Bearer $UT" | json "d['itemsCount']")"
check "checkout rejects changed price" "409" "$(code -H 'Content-Type: application/json' -H "Authorization: Bearer $UT" -X POST "$B/api/orders" -d "$STALE_CHECKOUT")"
ORDER=$(post /api/orders "$GOOD_CHECKOUT" POST -H "Authorization: Bearer $UT")
NUMBER=$(echo "$ORDER" | json "d['order']['number']")
OID=$(echo "$ORDER" | json "d['order']['id']")
check "order has whatsapp link" "True" "$(echo "$ORDER" | json "d['whatsappUrl'].startswith('https://wa.me/')")"
check "cart cleared after order" "0" "$(curl -s -H "Authorization: Bearer $UT" "$B/api/cart" | json "d['itemsCount']")"
check "my orders" "$NUMBER" "$(curl -s -H "Authorization: Bearer $UT" "$B/api/orders/my" | json "d['items'][0]['number']")"
check "track with phone" "NEW" "$(curl -s "$B/api/orders/track/$NUMBER?phone=%2B77010000001" | json "d['status']")"
check "track with wrong phone" "404" "$(code "$B/api/orders/track/$NUMBER?phone=87019999999")"

echo "== admin orders"
H=(-H "Authorization: Bearer $AT")
check "illegal transition" "409" "$(code "${H[@]}" -H 'Content-Type: application/json' -X PATCH "$B/api/admin/orders/$OID/status" -d '{"status":"COMPLETED"}')"
check "confirm" "CONFIRMED" "$(post "/api/admin/orders/$OID/status" '{"status":"CONFIRMED","note":"Позвонили клиенту"}' PATCH "${H[@]}" | json "d['status']")"
check "cancel returns stock" "CANCELLED" "$(post "/api/admin/orders/$OID/status" '{"status":"CANCELLED"}' PATCH "${H[@]}" | json "d['status']")"

echo "== admin products & media"
CAT=$(curl -s "${H[@]}" "$B/api/admin/categories" | json "d[0]['id']")
NEW=$(post /api/admin/products "{\"nameRu\":\"Тестовый шампунь с алоэ\",\"categoryId\":$CAT,\"brandName\":\"Smoke Brand\",\"price\":5000,\"stockQuantity\":3,\"benefits\":[{\"textRu\":\"Мягко очищает\"}],\"status\":\"DRAFT\"}" POST "${H[@]}")
NID=$(echo "$NEW" | json "d['id']")
check "created product slug" "testovyy-shampun-s-aloe" "$(echo "$NEW" | json "d['slug'][:23]")"
check "publish without photo blocked" "422" "$(code "${H[@]}" -H 'Content-Type: application/json' -X PATCH "$B/api/admin/products/$NID/status" -d '{"status":"PUBLISHED"}')"
IMG=$(ls "$SEED_DIR/images" | head -1)
UP=$(curl -s "${H[@]}" -F "file=@$SEED_DIR/images/$IMG" -F kind=PHOTO -F "title=Главное фото" -F "description=Вид спереди" "$B/api/admin/products/$NID/media")
check "photo upload becomes cover" "True" "$(echo "$UP" | json "d['cover']")"
DOC_UP=$(printf 'Сертификат соответствия' > "$TMP/cert.txt"; curl -s "${H[@]}" -F "file=@$TMP/cert.txt" -F kind=DOCUMENT -F "title=Сертификат" "$B/api/admin/products/$NID/media")
check "document upload" "DOCUMENT" "$(echo "$DOC_UP" | json "d['kind']")"
check "fake image rejected" "400" "$(code "${H[@]}" -F "file=@$TMP/cert.txt;filename=fake.png" -F kind=PHOTO "$B/api/admin/products/$NID/media")"
check "publish with photo" "PUBLISHED" "$(post "/api/admin/products/$NID/status" '{"status":"PUBLISHED"}' PATCH "${H[@]}" | json "d['status']")"
check "visible in catalog" "True" "$(curl -s "$B/api/catalog/products?q=%D0%B0%D0%BB%D0%BE%D1%8D" | json "any(i['id']==$NID for i in d['items'])")"
VERSION=$(curl -s "${H[@]}" "$B/api/admin/products/$NID" | json "d['version']")
STALE_UPDATE="{\"nameRu\":\"X\",\"price\":5000,\"version\":$((VERSION - 1))}"
check "stale update rejected" "409" "$(code "${H[@]}" -H 'Content-Type: application/json' -X PUT "$B/api/admin/products/$NID" -d "$STALE_UPDATE")"
check "parse description" "True" "$(post /api/admin/products/parse-description '{"text":"Очищает кожу Увлажняет Применение: наносить утром. Состав: вода, алоэ.","name":"Крем 50 мл"}' POST "${H[@]}" | json "d['volume']=='50 мл' and len(d['benefits'])==2")"
check "delete product" "False" "$(curl -s "${H[@]}" -X DELETE "$B/api/admin/products/$NID" | json "d['archived']")"

rm -rf "$TMP"
if [[ $FAILED -eq 0 ]]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; exit 1; fi
