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

  // 新規接続者に自身のIDと現在のユーザーリストを送信
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId,
    users: clients.map(c => ({ id: c.id, username: c.username }))
  }))

  // 他のクライアントに新規参加を通知
  broadcast({
    type: 'system',
    message: `${username}さんが参加しました。`,
  })

  // 更新されたユーザーリストを全クライアントに送信
  broadcastUserList()

  ws.on('message', (message) => {
    const data = JSON.parse(message)
    const outgoingMessage = {
      senderId: clientId,
      username: username,
      ...data,
    }
    broadcast(outgoingMessage)
  })

  ws.on('close', () => {
    const leavingUser = clients.find((client) => client.id === clientId)
    clients = clients.filter((client) => client.id !== clientId)
    console.log(`${leavingUser?.username || 'A user'} disconnected. Total clients: ${clients.length}`)

    if (leavingUser) {
      broadcast({
        type: 'system',
        message: `${leavingUser.username}さんが退出しました。`,
      })
    }
    broadcastUserList()
  })
})

function broadcast(message) {
  const data = JSON.stringify(message)
  clients.forEach((client) => {
    if (client.ws.readyState === 1) {
      client.ws.send(data)
    }
  })
}

function broadcastUserList() {
  const userList = clients.map(c => ({ id: c.id, username: c.username }))
  const message = { type: 'user_list', users: userList }
  broadcast(message)
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
