
import { clipboard } from 'electron';
import { keyTap } from 'robotjs';

const getSelectedText = async () => {

  const currentClipboardContent = clipboard.readText();
  clipboard.clear();
  keyTap("c", process.platform === "darwin" ? "command" : "control");
  await new Promise((resolve) => setTimeout(resolve, 200));
  const selectedText = clipboard.readText();
  clipboard.writeText(currentClipboardContent);
  return selectedText;

}

const pasteText = async (text) => {

  const currentClipboardContent = clipboard.readText();
  clipboard.writeText(text)
  keyTap("v", process.platform === "darwin" ? "command" : "control");
  await new Promise((resolve) => setTimeout(resolve, 200));
  clipboard.writeText(currentClipboardContent);
  
}

export {
  getSelectedText,
  pasteText
}
