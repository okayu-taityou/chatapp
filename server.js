// server.js
const express = require('express')
const expressWs = require('express-ws')
const { v4: uuidv4 } = require('uuid')

const app = express()
expressWs(app)

const port = process.env.PORT || 3001
let clients = []

app.use(express.static('public'))

app.ws('/ws', (ws, req) => {
  const clientId = uuidv4()
  const username = req.query.username || 'Anonymous'
  const clientInfo = { id: clientId, username: username, ws: ws }
  clients.push(clientInfo)

  console.log(`${username} (${clientId}) connected. Total clients: ${clients.length}`)

  // 1. 新規ユーザーの参加を全員に通知（システムメッセージ）
  broadcast({
    type: 'system',
    message: `${username}さんが参加しました。`,
  })

  // 2. 最新のユーザーリストを全員にブロードキャスト
  broadcastUserList()

  ws.on('message', (message) => {
    const data = JSON.parse(message)
    console.log(`Received from ${username}:`, data)

    // メッセージの種類に応じて処理を分岐
    switch (data.type) {
      case 'chat':
        const outgoingChatMessage = {
          type: 'chat',
          senderId: clientId,
          username: username,
          text: data.text,
        }
        // ★★★ 修正点 ★★★
        // 自分以外の全員にチャットメッセージをブロードキャスト
        clients.forEach((client) => {
          if (client.id !== clientId && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(outgoingChatMessage))
          }
        })
        break

      case 'paint':
        const outgoingPaintMessage = {
          senderId: clientId,
          username: username,
          ...data,
        }
        // お絵かき情報は全員に（自分にも）送って、全画面の同期を保証する
        broadcast(outgoingPaintMessage, true)
        break
    }
  })

  ws.on('close', () => {
    const leavingUser = clients.find((client) => client.id === clientId)
    clients = clients.filter((client) => client.id !== clientId)
    console.log(`${leavingUser?.username || 'A user'} disconnected. Total clients: ${clients.length}`)

    if (leavingUser) {
      // ユーザーの退出を全員に通知
      broadcast({
        type: 'system',
        message: `${leavingUser.username}さんが退出しました。`,
      })
    }
    // ユーザーリストを更新して全員に通知
    broadcastUserList()
  })
})

// 全員にメッセージを送信するヘルパー関数
function broadcast(message) {
  const data = JSON.stringify(message)
  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(data)
    }
  })
}

// 最新のユーザーリストを全員に送信する関数
function broadcastUserList() {
  const userList = clients.map((c) => ({ id: c.id, username: c.username }))
  broadcast({ type: 'user_list', users: userList })
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
