#!/usr/bin/env sh

KEY_CHAIN=build.keychain
CERTIFICATE_CER=certificate.cer

# list signing certificates
security find-identity -v -p codesigning

# recreate the certificate from the secure environment variable
echo $IDENTITY_DARWIN_CER | base64 --decode > $CERTIFICATE_CER

# create a keychain
security create-keychain -p actions $KEY_CHAIN
security default-keychain -s $KEY_CHAIN
security unlock-keychain -p actions $KEY_CHAIN

# import the certificate into the keychain
security import $CERTIFICATE_CER -k $KEY_CHAIN -T /usr/bin/codesign;

# set keychain settings
security set-key-partition-list -S apple-tool:,apple: -s -k actions $KEY_CHAIN

# list signing certificates again
security find-identity -v -p codesigning

# remove certs
rm -fr CERTIFICATE_CER
