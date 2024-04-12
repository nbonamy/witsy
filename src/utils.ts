
export const wait = async (millis:number = 200) => {
  await new Promise((resolve) => setTimeout(resolve, millis));
}
