
/* eslint-disable @typescript-eslint/no-require-imports */

try {
  module.exports = require('node-gyp-build')(__dirname)
} catch (err) {
  console.error('Failed to load native module:', err)
  module.exports = {
    sendCtrlKey: function() {
      console.warn('autolib: SendCtrlKey mock')
      return 0
    }
  }
}
