
clean:
	rm -rf dist

mac:
	-rm dist/*.dmg dist/*.zip
	npx electron-builder --mac --arm64
	npx electron-builder --mac --x64

win:
	-rm dist/*.exe dist/*.zip
	npx electron-builder --win --x64

all: clean mac win
