
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('assert');
const { describe, it } = require('mocha');
const keysender = require('../index');

describe('KeySender Module', function() {
  it('should send Ctrl+C', async function() {
    const result = await keysender.sendCtrlKey('C');
    assert.strictEqual(result, 1, 'Expected result to be 1 (success)');
  });

  it('should send Ctrl+V', async function() {
    const result = await keysender.sendCtrlKey('V');
    assert.strictEqual(result, 1, 'Expected result to be 1 (success)');
  });

  it('should handle errors gracefully', async function() {
    try {
      await keysender.sendCtrlKey('INVALID_KEY');
    } catch (error) {
      assert.ok(error, 'Expected an error to be thrown for invalid key');
    }
  });
});