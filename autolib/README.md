# Witsy autolib

This project provides a Node.js native module for required automations in Witsy. The goal is to avoid spawning a third-party process such as `applescript`, `cscript` or `powershell` to avoid focus management issues between applications.

## Installation

To install the module, clone the repository and run the following commands:

```bash
npm install
```

## Building the Module

Before using the module, you need to build it using `node-gyp`. Make sure you have `node-gyp` installed globally:

```bash
npm install -g node-gyp
```

Then, navigate to the project directory and run:

```bash
node-gyp rebuild
```

## Usage

After building the module, you can use it in your Node.js application. Here’s a simple example:

```javascript
const autolib = require('autolib');
autolib.sendControlKey('C');
```

## API

### `sendControlKey(key)`

Sends a control key combination. The `key` parameter should be a string representing the key you want to send (e.g., 'C', 'V').

## Testing

To run the tests, you can use the following command:

```bash
npm test
```

Make sure to have a testing framework like Mocha or Jest set up in your project.
