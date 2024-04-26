
# This Makefile is used to build the electron app for different platforms.
# On MacOS, you need to have the codesigning identity in the .env file.
# Check available identities with `security find-identity -v -p codesigning`
# The .env file should have the following lines:
# IDENTITY="Developer ID Application: Your Name (XXXXXXXXXX)"
# APPLE_ID=""
# APPLE_TEAM_ID=""
# APPLE_PASSWORD="app-specific-password"

VERSION := $(shell grep "version" package.json | cut -d '"' -f 4)
#IDENTITY := $(shell if [ -f .env ]; then grep IDENTITY .env | cut -d'=' -f2 || echo "-"; else echo "-"; fi)
#CODESIGN_OPTS := --force --deep --entitlements ./assets/Entitlements.plist --sign $(IDENTITY)
BUILD_NUMBER_FILE := ./build/build_number.txt

default: mac-arm64

test:
	npx vitest --run

clean:
	-rm -rf out

mac-arm64:
	-rm -rf out/*darwin-arm64* out/make/zip/darwin/arm64/*
	npx electron-forge make -p darwin -a arm64

mac-x64:
	-rm -rf out/*darwin-x64* out/make/zip/darwin/x64/*
	npx electron-forge make -p darwin -a x64

mac-mas:
	-rm -rf out/*mas-universal* out/make/zip/mas/universal/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge make -p mas -a universal

mac: increment-build-number mac-mas

win-x64:
	-rm -rf out/*win32-x64* out/make/zip/win32/x64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge package -p win32 -a x64
	mkdir -p out/make/zip/win32/x64
	cd out ; zip -r make/zip/win32/x64/Witsy-win32-x64-$(VERSION).zip "Witsy-win32-x64"

win: win-x64

linux-x64:
	-rm -rf out/*linux-x64* out/make/zip/linux/x64/*
	BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)) npx electron-forge package -p linux -a x64
	mkdir -p out/make/zip/linux/x64
	cd out ; zip -r make/zip/linux/x64/Witsy-linux-x64-$(VERSION).zip "Witsy-linux-x64/"

linux: linux-x64

all: clean increment-build-number mac-arm64 mac-x64 win linux

increment-build-number:
	$(eval CURRENT_BUILD_NUMBER=$(shell cat $(BUILD_NUMBER_FILE)))
	$(eval NEW_BUILD_NUMBER=$(shell echo $$(( $(CURRENT_BUILD_NUMBER) + 1 ))))
	@echo $(NEW_BUILD_NUMBER) > $(BUILD_NUMBER_FILE)

publish:
	$(eval RELEASES := $(shell find out -name '*$(VERSION).zip'))
	gh release create v$(VERSION) --repo https://github.com/nbonamy/witty-ai --title $(VERSION) $(RELEASES) --notes "Release $(VERSION)"
