#include "keysender.h"
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#elif defined(__APPLE__)
#include <ApplicationServices/ApplicationServices.h>
#endif

uint32_t SendCtrlKey(const char *key)
{
#ifdef _WIN32
  BYTE keyCode = 0;

  if (strcmp(key, "C") == 0)
  {
    keyCode = 0x43; // VK_C
  }
  else if (strcmp(key, "V") == 0)
  {
    keyCode = 0x56; // VK_V
  }
  else
  {
    return 0; // Error: Unsupported key
  }

  INPUT inputs[4] = {0};
  inputs[0].type = INPUT_KEYBOARD;
  inputs[0].ki.wVk = VK_CONTROL;

  inputs[1].type = INPUT_KEYBOARD;
  inputs[1].ki.wVk = keyCode;

  inputs[2].type = INPUT_KEYBOARD;
  inputs[2].ki.wVk = keyCode;
  inputs[2].ki.dwFlags = KEYEVENTF_KEYUP;

  inputs[3].type = INPUT_KEYBOARD;
  inputs[3].ki.wVk = VK_CONTROL;
  inputs[3].ki.dwFlags = KEYEVENTF_KEYUP;

  UINT numSent = SendInput(4, inputs, sizeof(INPUT));
  return numSent == 4 ? 1 : 0;

#elif defined(__APPLE__)
  CGKeyCode keyCode;

  // Define key codes for C and V on macOS
  if (strcmp(key, "C") == 0)
  {
    keyCode = 8; // C key on macOS
  }
  else if (strcmp(key, "V") == 0)
  {
    keyCode = 9; // V key on macOS
  }
  else
  {
    return 0; // Error: Unsupported key
  }

  // Get the current event source
  CGEventSourceRef sourceRef = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);

  // Create events for Command + key
  CGEventRef keyDown = CGEventCreateKeyboardEvent(sourceRef, keyCode, true);
  CGEventRef keyUp = CGEventCreateKeyboardEvent(sourceRef, keyCode, false);

  // Add Command modifier
  CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
  CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);

  // Post the events
  CGEventPost(kCGHIDEventTap, keyDown);
  usleep(20000); // Wait for 20ms
  CGEventPost(kCGHIDEventTap, keyUp);

  // Release the objects
  CFRelease(keyDown);
  CFRelease(keyUp);
  CFRelease(sourceRef);

  return 1; // Success

#else
  // For other platforms, just return success without doing anything
  return 1;
#endif
}