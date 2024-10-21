#!/usr/bin/env sh

KEYCHAIN_PATH=$RUNNER_TEMP/build.keychain-db
CERTIFICATE_PATH=$RUNNER_TEMP/certificate.p12

# list signing certificates
security find-identity -v -p codesigning

# recreate the certificate from the secure environment variable
echo $BUILD_CERTIFICATE_BASE64 | base64 --decode -o $CERTIFICATE_PATH

# create a keychain
security create-keychain -p "$APPLE_PASSWORD" $KEYCHAIN_PATH
security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
security unlock-keychain -p "$APPLE_PASSWORD" $KEYCHAIN_PATH

# import the certificate into the keychain
security import $CERTIFICATE_PATH -P "$APPLE_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
security set-key-partition-list -S apple-tool:,apple: -k "$APPLE_PASSWORD" $KEYCHAIN_PATH
security list-keychain -d user -s $KEYCHAIN_PATH

# list signing certificates again
security find-identity -v -p codesigning

# remove certs
rm -fr CERTIFICATE_PATH
rm -fr PROFILE_PATH
