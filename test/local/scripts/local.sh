#!/usr/bin/env bash
# Single entrypoint for running Mijn Nijmegen locally on MiniStack. See
# test/local/README.md.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

REGION=eu-central-1
ACCOUNT=000000000000
APP_URL=http://localhost:3000

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=$REGION
export AWS_REGION=$REGION

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Individual steps:
  up              Start MiniStack, Keycloak, the backend mock and the proxy
  down            Tear down the docker compose stack (including volumes)
  deploy          Bundle the lambdas and static resources, then
                  cdk bootstrap + cdk deploy LocalMijnNijmegenStack into MiniStack
  logs [function] Poll and print a Lambda's CloudWatch logs (default: auth,
                  Ctrl-C to stop)

Combinations:
  start           down, up, deploy - full stack from scratch
EOF
}

cmd_up() {
  docker compose up -d

  echo "Waiting for MiniStack..."
  until curl -sf http://localhost:4566/_ministack/health > /dev/null; do sleep 1; done

  echo "Waiting for Keycloak..."
  until curl -sf http://localhost:8081/realms/mijn-nijmegen/.well-known/openid-configuration > /dev/null; do sleep 2; done
}

cmd_down() {
  docker compose down -v
}

cmd_deploy() {
  (
    cd ../..
    npx projen bundle                      # all lambdas
    npx projen bundle:css-bundle           # static/styles/ds.css
    npx projen bundle:copy-web-components  # static/js/web-components/
  )
  npx cdk bootstrap "aws://${ACCOUNT}/${REGION}"
  npx cdk deploy --require-approval never
}

cmd_logs() {
  # `aws logs tail --follow` crashes against MiniStack with `[ERROR]: 'eventId'`:
  # its --follow implementation reads event['eventId'] for client-side dedup,
  # which MiniStack's FilterLogEvents doesn't return. This polls
  # FilterLogEvents directly instead.
  local log_group="/aws/lambda/local-${1:-auth}"
  local start_time
  start_time=$(($(date +%s) * 1000))

  echo "Polling ${log_group} every 2s (Ctrl-C to stop)..."
  while true; do
    events=$(aws logs filter-log-events \
      --log-group-name "$log_group" \
      --start-time "$start_time" \
      --output json 2>/dev/null) || events='{"events":[]}'

    count=$(echo "$events" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['events']))")
    if [ "$count" -gt 0 ]; then
      echo "$events" | python3 -c "
import json, sys
for e in json.load(sys.stdin)['events']:
    print(e['message'].rstrip())
"
      start_time=$(echo "$events" | python3 -c "import json,sys; print(max(e['timestamp'] for e in json.load(sys.stdin)['events']) + 1)")
    fi
    sleep 2
  done
}

cmd_start() {
  cmd_down
  cmd_up
  cmd_deploy
  echo
  cat <<EOF
Mijn Nijmegen is running on ${APP_URL}

Log in on ${APP_URL}/login with (password = username):
  DigiD        digid-999999333       (N. Boeddhoe, with zaken, taken and uitkeringen)
  DigiD        digid-999998754       (H. van Hapert)
  eHerkenning  eherkenning-69599084  (Mock Bedrijf B.V.)
EOF
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  deploy) cmd_deploy ;;
  logs) cmd_logs "${2:-}" ;;
  start) cmd_start ;;
  -h|--help|help|"") usage ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
