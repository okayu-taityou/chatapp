// --- server.js ---
const express = require('express')
const expressWs = require('express-ws')
const { v4: uuidv4 } = require('uuid') // ID生成のためにuuidをインストールしてください: npm install uuid

const app = express()
expressWs(app)

const port = process.env.PORT || 3001
let clients = [] // 'connects' から 'clients' に名前を変更し、より多くの情報を格納

app.use(express.static('public'))

app.ws('/ws', (ws, req) => {
  const clientId = uuidv4()
  const username = req.query.username || 'Anonymous'
  clients.push({ id: clientId, username: username, ws: ws })

  console.log(`${username} (${clientId}) connected.`)

  // 接続時に現在のユーザーリストを全員に通知
  broadcastUserList()

  // 新規ユーザーの参加を全員に通知
  broadcast({
    type: 'system',
    message: `${username}さんが参加しました。`,
  })

  ws.on('message', (message) => {
    const data = JSON.parse(message)
    console.log(`Received from ${username}:`, data)

    // 受信したメッセージに送信者の情報を付与
    const outgoingMessage = {
      senderId: clientId,
      username: username,
      ...data,
    }

    // 自分以外の全員にブロードキャスト
    clients.forEach((client) => {
      // 送信者には送らない & 接続がオープンなクライアントにのみ送信
      if (client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(outgoingMessage))
      }
    })
  })

  ws.on('close', () => {
    const leavingUser = clients.find((client) => client.id === clientId)
    clients = clients.filter((client) => client.id !== clientId)
    console.log(`${leavingUser.username} (${clientId}) disconnected.`)
    
    // ユーザーの退出を全員に通知
    if (leavingUser) {
      broadcast({
        type: 'system',
        message: `${leavingUser.username}さんが退出しました。`,
      })
    }
    // ユーザーリストを更新して全員に通知
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
    const userList = clients.map(c => ({ id: c.id, username: c.username }));
    broadcast({ type: 'user_list', users: userList });
}


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
