
# This Makefile is used to build the electron app for different platforms.
# On MacOS, you need to have the codesigning identity in the .env file.
# Check available identities with `security find-identity -v -p codesigning`
# The .env file should have the following lines:
# IDENTIFY_DARWIN_CODE="Developer ID Application: Your Name (XXXXXXXXXX)"
# APPLE_ID=""
# APPLE_TEAM_ID=""
# APPLE_PASSWORD="app-specific-password"

VERSION := $(shell grep "version" package.json | cut -d '"' -f 4)
#IDENTITY := $(shell if [ -f .env ]; then grep IDENTITY .env | cut -d'=' -f2 || echo "-"; else echo "-"; fi)
#CODESIGN_OPTS := --force --deep --entitlements ./assets/Entitlements.plist --sign $(IDENTITY)
CURRENT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
BUILD_NUMBER_FILE := ./build/build_number.txt

# Global environment variables for all targets
export NODE_OPTIONS := --max_old_space_size=4096

default: increment-build-number mac-arm64

# Watch mode for lint and test
watch-all:
	@command -v tmux > /dev/null || (echo "Please install tmux: brew install tmux" && exit 1)
	@tmux new-session \; \
		set-option -g mouse on \; \
		send-keys 'npm run lint:watch' C-m \; \
		split-window -v \; \
		send-keys 'npm run test:watch' C-m \; \
		select-pane -t 0
		
test:
	npx vitest --run

clean:
	-rm -rf out

mac-arm64:
	-rm -rf out/*darwin-arm64* out/make/zip/darwin/arm64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge make -p darwin -a arm64
	cd out/make/zip/darwin/arm64/ ; mv Witsy-darwin-arm64-$(VERSION).zip Witsy-$(VERSION)-darwin-arm64.zip
	cd out/make ; mv Witsy-$(VERSION)-arm64.dmg Witsy-$(VERSION)-darwin-arm64.dmg

mac-x64:
	-rm -rf out/*darwin-x64* out/make/zip/darwin/x64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge make -p darwin -a x64
	cd out/make/zip/darwin/x64/ ; mv Witsy-darwin-x64-$(VERSION).zip Witsy-$(VERSION)-darwin-x64.zip
	cd out/make ; mv Witsy-$(VERSION)-x64.dmg Witsy-$(VERSION)-darwin-x64.dmg

mac: mac-arm64 mac-x64

win-x64:
	-rm -rf out/*win32-x64* out/make/zip/win32/x64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge package -p win32 -a x64
	mkdir -p out/make/zip/win32/x64
	cd out ; zip -r make/zip/win32/x64/Witsy-$(VERSION)-win32-x64.zip "Witsy-win32-x64"

win-arm64:
	-rm -rf out/*win32-arm64* out/make/zip/win32/arm64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge package -p win32 -a arm64
	mkdir -p out/make/zip/win32/arm64
	cd out ; zip -r make/zip/win32/arm64/Witsy-$(VERSION)-win32-arm64.zip "Witsy-win32-arm64"

win: win-x64 win-arm64

linux-x64:
	-rm -rf out/*linux-x64* out/make/zip/linux/x64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge make -p linux -a x64
	cd out/make/zip/linux/x64 ; mv Witsy-linux-x64-$(VERSION).zip Witsy-$(VERSION)-linux-x64.zip

linux-arm64:
	-rm -rf out/*linux-arm64* out/make/zip/linux/arm64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge make -p linux -a arm64
	cd out/make/zip/linux/arm64 ; mv Witsy-linux-arm64-$(VERSION).zip Witsy-$(VERSION)-linux-arm64.zip

linux: linux-x64

all: clean increment-build-number mac win linux

increment-build-number:
	$(eval CURRENT_BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)))
	$(eval NEW_BUILD_NUMBER=$(shell echo $$(( $(CURRENT_BUILD_NUMBER) + 1 ))))
	@echo $(NEW_BUILD_NUMBER) > $(BUILD_NUMBER_FILE)

commit-build-number:
	@git add $(BUILD_NUMBER_FILE)
	@git commit -m "increment build number"
	@git push

build-release:
	@git diff --quiet || (echo "There are uncommitted changes. Stopping." && exit 1)
	@$(MAKE) increment-build-number
	@$(MAKE) commit-build-number
	gh release create v$(VERSION) --title $(VERSION) --notes "[CHANGELOG.md](CHANGELOG.md)" --draft
	gh workflow run build-darwin-arm64.yml --ref $(CURRENT_BRANCH)
	gh workflow run build-darwin-x64.yml --ref $(CURRENT_BRANCH)
	gh workflow run build-linux-x64.yml --ref $(CURRENT_BRANCH)
	gh workflow run build-win32-arm64.yml --ref $(CURRENT_BRANCH)
	gh workflow run build-win32-x64.yml --ref $(CURRENT_BRANCH)
	node build/monitor_gh_builds.mjs

prerelease:
	@$(MAKE) build-release
	gh release edit v$(VERSION) --draft=false --prerelease

publish:
	@$(MAKE) build-release
	gh release edit v$(VERSION) --draft=false --latest
	@echo "{\"schemaVersion\":1,\"label\":\"Version\",\"message\":\"$(VERSION)\",\"labelColor\":\"rgb(61, 70, 78)\",\"color\":\"blue\"}" > $(TMPDIR)/version.json
	gh gist edit 8febadb1ecb32078db4c003d0c09f565 -f version.json $(TMPDIR)/version.json
	@rm $(TMPDIR)/version.json

latest: publish
