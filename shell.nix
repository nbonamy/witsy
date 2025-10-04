with import <nixpkgs> {};
let
  libs = lib.makeLibraryPath [
    stdenv.cc.cc
    glibc
    glib
    gtk3
    pango
    cairo
    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    alsa-lib
    nss
    nspr
    dbus
    atk
    cups
    libdrm
    gdk-pixbuf
    expat
    xorg.libxcb
    libxkbcommon
    at-spi2-core
    mesa
    libglvnd
    libgbm
  ];
in
mkShell {
  NIX_LD_LIBRARY_PATH = libs;
  NIX_LD = lib.fileContents "${stdenv.cc}/nix-support/dynamic-linker";
  LD_LIBRARY_PATH = libs;
}
