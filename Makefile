
VERSION := $(shell grep "version" package.json | cut -d '"' -f 4)

default: mac-arm64

clean:
	-rm -rf out

mac-arm64:
	-rm -rf out/*darwin-arm64*
	npx electron-forge package -p darwin -a arm64
	codesign --force --deep --sign - "out/Witty AI-darwin-arm64/Witty AI.app"
	cd out ; zip -r Witty_AI-darwin-arm64.zip "Witty AI-darwin-arm64/"

mac-x64:
	-rm -rf out/*darwin-x64*
	npx electron-forge package -p darwin -a x64
	codesign --force --deep --sign - "out/Witty AI-darwin-x64/Witty AI.app"
	cd out ; zip -r Witty_AI-darwin-x64.zip "Witty AI-darwin-x64/"

mac: mac-arm64 mac-x64

win-x64:
	-rm -rf out/*win32-x64*
	npx electron-forge package -p win32 -a x64
	cd out ; zip -r Witty_AI-win32-x64.zip "Witty AI-win32-x64"

win: win-x64

linux-x64:
	-rm -rf out/*linux-arm64*
	npx electron-forge package -p linux -a x64
	cd out ; zip -r Witty_AI-linux-x64.zip "Witty AI-linux-x64/"

linux: linux-x64

all: clean mac win linux

publish:
	gh release create v$(VERSION) --title $(VERSION) --generate-notes ./out/*.zip
