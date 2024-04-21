
# This Makefile is used to build the electron app for different platforms.
# On MacOS, you need to have the codesigning identity in the .env file.
# Check available identities with `security find-identity -v -p codesigning`
# The .env file should have the following lines:
# IDENTITY="Developer ID Application: Your Name (XXXXXXXXXX)"
# APPLE_ID=""
# APPLE_TEAM_ID=""
# APPLE_PASSWORD="app-specific-password"

VERSION := $(shell grep "version" package.json | cut -d '"' -f 4)
IDENTITY := $(shell if [ -f .env ]; then grep IDENTITY .env | cut -d'=' -f2 || echo "-"; else echo "-"; fi)
CODESIGN_OPTS := --force --deep --entitlements ./assets/Entitlements.plist --sign $(IDENTITY)

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

mac-universal:
	-rm -rf out/*darwin-universal* out/make/zip/darwin/universal/*
	npx electron-forge make -p darwin -a universal

mac: mac-universal

win-x64:
	-rm -rf out/*win32-x64* out/make/zip/win32/x64/*
	npx electron-forge package -p win32 -a x64
	mkdir -p out/make/zip/win32/x64
	cd out ; zip -r make/zip/win32/x64/Maiestro-win32-x64-$(VERSION).zip "Maiestro-win32-x64"

win: win-x64

linux-x64:
	-rm -rf out/*linux-x64* out/make/zip/linux/x64/*
	npx electron-forge package -p linux -a x64
	mkdir -p out/make/zip/linux/x64
	cd out ; zip -r make/zip/linux/x64/Maiestro-linux-x64-$(VERSION).zip "Maiestro-linux-x64/"

linux: linux-x64

all: clean mac win linux

#publish:
#	$(eval RELEASES := $(shell find out -name '*$(VERSION).zip'))
#	gh release create v$(VERSION) --repo https://github.com/nbonamy/witty-ai-releases --title $(VERSION) $(RELEASES)
