
export const wait = async (millis = 200) => {
  if (process.platform === 'win32') {
    // for an unknown reason, the promise code started to fail on Windows
    const waitTill = new Date(new Date().getTime() + millis);
    while (waitTill > new Date()) {
      // do nothing
    }
  } else {
    await new Promise((resolve) => setTimeout(resolve, millis));
  }
}
