
#include <node_api.h>
#include <string.h>
#include "keysender.h"

static napi_value SendCtrlKeyWrapper(napi_env env, napi_callback_info info)
{
  napi_status status;
  size_t argc = 1;
  napi_value args[1];
  char buffer[32]; // Sufficient for key characters
  size_t buffer_size = sizeof(buffer);

  // Get the arguments
  status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (status != napi_ok || argc < 1)
  {
    napi_throw_error(env, NULL, "Expected a string argument");
    return NULL;
  }

  // Get the string value
  status = napi_get_value_string_utf8(env, args[0], buffer, buffer_size, NULL);
  if (status != napi_ok)
  {
    napi_throw_error(env, NULL, "Expected a string argument");
    return NULL;
  }

  // Call the function and create return value
  uint32_t result = SendCtrlKey(buffer);
  napi_value return_val;
  napi_create_uint32(env, result, &return_val);

  return return_val;
}

static napi_value Init(napi_env env, napi_value exports)
{
  napi_value fn;
  napi_create_function(env, NULL, 0, SendCtrlKeyWrapper, NULL, &fn);
  napi_set_named_property(env, exports, "sendCtrlKey", fn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)