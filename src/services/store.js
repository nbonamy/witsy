
import { reactive } from 'vue'
import Chat from '../models/chat'
import path from 'path'
import fs from 'fs'

export const store = reactive({
  config: {},
  chats: [],
})

function historyFilePath() {
  return path.join('/Users/nbonamy/Library/Application Support/witty-ai', 'history.json')
}

export function loadStore() {
  try {
    store.chats = []
    const data = fs.readFileSync(historyFilePath(), 'utf-8')
    const jsonChats = JSON.parse(data)
    for (let jsonChat of jsonChats) {
      let chat = new Chat(jsonChat)
      store.chats.push(chat)
    }
  } catch (error) {
    console.log('Error retrieving user data', error)
  }
}

export function saveStore() {
  fs.writeFileSync(historyFilePath(), JSON.stringify(store.chats.filter((chat) => chat.messages.length > 1)))
}
