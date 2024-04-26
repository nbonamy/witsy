
export const wait = async (millis = 200) => {
  await new Promise((resolve) => setTimeout(resolve, millis));
}
