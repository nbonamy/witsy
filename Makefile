
build:
	rm -rf dist
	npx electron-builder --mac --arm64
	npx electron-builder --mac --x64
	npx electron-builder --win --x64
