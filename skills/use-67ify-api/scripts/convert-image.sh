#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
	printf 'Usage: %s <api-base-url> <input-image> <output.gif> [67|55]\n' "$0" >&2
	exit 64
fi

api_base="${1%/}"
input_image="$2"
output_gif="$3"
mode="${4:-67}"

if [ "$mode" != "67" ] && [ "$mode" != "55" ]; then
	printf 'Mode must be 67 or 55, got: %s\n' "$mode" >&2
	exit 64
fi

if [ ! -f "$input_image" ]; then
	printf 'Input image not found: %s\n' "$input_image" >&2
	exit 66
fi

tmp_output="$(mktemp "${TMPDIR:-/tmp}/67ify-api.XXXXXX")"
tmp_headers="$(mktemp "${TMPDIR:-/tmp}/67ify-api-headers.XXXXXX")"
cleanup() {
	rm -f "$tmp_output" "$tmp_headers"
}
trap cleanup EXIT

status="$(
	curl --silent --show-error \
		--output "$tmp_output" \
		--dump-header "$tmp_headers" \
		--write-out '%{http_code}' \
		--request POST "$api_base/api/convert" \
		--form "image=@${input_image}" \
		--form "mode=${mode}"
)"

if [ "$status" != "200" ]; then
	printf '67ify API request failed with HTTP %s\n' "$status" >&2
	cat "$tmp_output" >&2
	printf '\n' >&2
	exit 1
fi

content_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print $2; exit}' "$tmp_headers" | tr -d '\r')"
case "$content_type" in
	image/gif*) ;;
	*)
		printf 'Expected image/gif response, got: %s\n' "${content_type:-unknown}" >&2
		exit 1
		;;
esac

mv "$tmp_output" "$output_gif"
trap - EXIT
rm -f "$tmp_headers"
printf '%s\n' "$output_gif"
