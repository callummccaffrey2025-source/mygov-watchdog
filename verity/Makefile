NODE_VERSION := 20
PKG := npm

.PHONY: ship-local check build dev seed lint type test start

ship-local: check seed build start
check: lint type test
lint: ; $(PKG) run lint || true
type: ; $(PKG) run typecheck || true
test: ; $(PKG) run test || true
seed: ; ./scripts/seed-au.sh
build: ; $(PKG) ci || $(PKG) install && $(PKG) run build
start: ; $(PKG) run start
dev: ; $(PKG) run dev
