import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import path from 'path'
import axios from 'axios'
import morgan from 'morgan'
const __dirname = path.resolve()

const app = express()

const http = axios.create({
  baseURL: 'http://192.168.1.11',
})

const rooms = new Map()

// sử dụng cors để kiểm tra origin
app.use(
  cors({
    credentials: true,
    origin: (req, next) => {
      next(null, true)
    },
  })
)

app.use(morgan('dev'))

app.use(express.json())

// middleware bắt lỗi
app.use((err, req, res, next) => {
  const status = err.status || 500
  console.log(err)
  return res.status(status).json({
    message: err,
  })
})

// gắn nghe cho app và gán vào server
const server = app.listen(process.env.PORT || 8081, '0.0.0.0', () => {
  console.log(`Server đang chạy ở cổng ${process.env.PORT || 8081}`)
})

const io = new Server(server)
// socket.io namespace (could represent a room?)
const connections = io.of('/mediasoup')

connections.on('connection', (socket) => {
  console.log('connection id: ', socket.id)

  socket.join(socket.id)

  socket.on('disconnect', async () => {
    // do some cleanup
    console.log('peer disconnected')
    const clearDataResp = await http.post('/clear-user', {
      roomId: rooms.get(socket.id),
      userId: socket.id,
    })
    rooms.delete(socket.id)
    console.log(clearDataResp.data)
    const clearData = clearDataResp.data
    clearData.receivePeers.forEach((receivePeer) => {
      socket
        .to(receivePeer)
        .emit('producer-closed', { remoteProducerIds: clearData.producerIds })
    })
  })
})

app.set('views', path.join(__dirname, 'public'))
app.set('view engine', 'ejs')

app.get('/sfu/:room', (req, res) => {
  const file = path.join(__dirname, 'public/index.html')
  console.log(file)

  return res.render('index')
})

app.post('/join-room', async (req, res, next) => {
  try {
    const { roomId, userId } = req.body

    rooms.set(userId, roomId)

    const response = await http.post('/join-room', {
      roomId: roomId,
      userId: userId,
    })

    return res.json(response.data)
  } catch (error) {
    next(error)
  }
})

app.post('/create-web-rtc-transport', async (req, res, next) => {
  try {
    const { roomId, userId, isConsumer } = req.body

    const transport = await http.post('/create-web-rtc-transport', {
      roomId,
      userId,
      isConsumer,
    })

    return res.json(transport.data)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-produser-connect', async (req, res, next) => {
  try {
    const { roomId, userId, serverTransportId, dtlsParameters } = req.body

    const transport = await http.post('/transport-produser-connect', {
      roomId,
      userId,
      serverTransportId,
      dtlsParameters,
    })

    return res.json(transport.data)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-produser-handle', async (req, res, next) => {
  try {
    const { roomId, userId, serverTransportId, kind, rtpParameters } = req.body

    const producerResp = await http.post('/transport-produser-handle', {
      roomId,
      userId,
      serverTransportId,
      kind,
      rtpParameters,
    })

    const producerData = producerResp.data
    if (producerData.producers && producerData.producers?.length > 0) {
      // handle
      producerData.producers.forEach((produser) => {
        console.log('send to user ', produser.userId)

        connections.to(produser.userId).emit('new-producer', {
          producerId: producerData.producerId,
        })
      })
    }

    console.log(producerResp.data)

    return res.json(producerData)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-consumer-connect', async (req, res, next) => {
  try {
    const { roomId, userId, serverTransportId, dtlsParameters } = req.body

    const transport = await http.post('/transport-consumer-connect', {
      roomId,
      userId,
      serverTransportId,
      dtlsParameters,
    })

    return res.json(transport.data)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-consumer-handle', async (req, res, next) => {
  try {
    const {
      roomId,
      userId,
      serverTransportId,
      rtpCapabilities,
      remoteProducerId,
    } = req.body

    const consumerResp = await http.post('/transport-consumer-handle', {
      roomId,
      userId,
      serverTransportId,
      rtpCapabilities,
      remoteProducerId,
    })

    return res.json(consumerResp.data)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-consumer-resume', async (req, res, next) => {
  try {
    const { roomId, userId, serverConsumerId } = req.body

    const consumerResp = await http.post('/transport-consumer-resume', {
      roomId,
      userId,
      serverConsumerId,
    })

    return res.json(consumerResp.data)
  } catch (error) {
    next(error)
  }
})
