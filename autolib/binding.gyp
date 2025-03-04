{
  "targets": [
    {
      "target_name": "autolib",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
        "src/addon.c",
        "src/keysender.c"
      ],
      "include_dirs": [],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 0
            }
          }
        }],
        ["OS=='mac'", {
          "link_settings": {
            "libraries": [
              "$(SDKROOT)/System/Library/Frameworks/ApplicationServices.framework"
            ]
          }
        }]
      ]
    }
  ]
}