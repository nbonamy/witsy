
import { clipboard } from 'electron';
import { keyTap } from 'robotjs';

export const moveCaretBelow = async () => {
  keyTap("right");
  keyTap("enter");
}

export const getSelectedText = async () => {


  const currentClipboardContent = clipboard.readText();
  clipboard.clear();
  keyTap("c", process.platform === "darwin" ? "command" : "control");
  await new Promise((resolve) => setTimeout(resolve, 200));
  const selectedText = clipboard.readText();
  clipboard.writeText(currentClipboardContent);
  return selectedText;

}

export const pasteText = async (text) => {

  const currentClipboardContent = clipboard.readText();
  clipboard.writeText(text)
  keyTap("v", process.platform === "darwin" ? "command" : "control");
  await new Promise((resolve) => setTimeout(resolve, 200));
  clipboard.writeText(currentClipboardContent);
  
}
