import express from 'express'
import MediasoupHandler from './mediasoup_handler'
import cors from 'cors'
import morgan from 'morgan'
const app = express()

const mediasoupHandler = new MediasoupHandler()
mediasoupHandler.makeWorker()
app.set('mediasoupHandler', mediasoupHandler)

app.use(express.json())

app.use(morgan('dev'))

// sử dụng cors để kiểm tra origin
app.use(
  cors({
    credentials: true,
    origin: (req, next) => {
      console.log(req)
      next(null, true)
    },
  })
)

// middleware bắt lỗi
app.use((err, req, res, next) => {
  const status = err.status || 500
  console.log(err)
  return res.status(status).json({
    message: err,
  })
})

// gắn nghe cho app và gán vào server
const server = app.listen(process.env.PORT || 80, '0.0.0.0', () => {
  console.log(`Server đang chạy ở cổng ${process.env.PORT || 80}`)
})

app.post('/join-room', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId } = req.body

    const router = await mediasoupHandler.getOrCreateRouter(roomId, userId)

    return res.json({
      rtpCapabilities: router.rtpCapabilities,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/create-web-rtc-transport', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId, isConsumer } = req.body

    const transport = await mediasoupHandler.createWebRtcTransport(
      roomId,
      userId,
      isConsumer ? 'consumerTransports' : 'producerTransports'
    )

    return res.json({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/transport-produser-connect', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId, serverTransportId, dtlsParameters } = req.body

    const transport = mediasoupHandler.getTransport(
      roomId,
      userId,
      serverTransportId,
      'producerTransports'
    )

    transport.connect({ dtlsParameters: dtlsParameters })

    return res.json({ message: 'success' })
  } catch (error) {
    next(error)
  }
})

app.post('/transport-produser-handle', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId, serverTransportId, kind, rtpParameters } = req.body

    const producerData = await mediasoupHandler.transportProduce(
      roomId,
      userId,
      serverTransportId,
      kind,
      rtpParameters
    )

    return res.json(producerData)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-consumer-connect', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId, serverTransportId, dtlsParameters } = req.body

    const transport = mediasoupHandler.getTransport(
      roomId,
      userId,
      serverTransportId,
      'consumerTransports'
    )

    await transport.connect({ dtlsParameters: dtlsParameters })

    return res.json({
      message: 'success',
    })
  } catch (error) {
    next(error)
  }
})

app.post('/transport-consumer-handle', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const {
      roomId,
      userId,
      serverTransportId,
      rtpCapabilities,
      remoteProducerId,
    } = req.body

    const TransportConsumeData = await mediasoupHandler.transportConsume(
      roomId,
      userId,
      serverTransportId,
      rtpCapabilities,
      remoteProducerId
    )

    return res.json(TransportConsumeData)
  } catch (error) {
    next(error)
  }
})

app.post('/transport-consumer-resume', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId, serverConsumerId } = req.body

    const consumer = mediasoupHandler.getConsumer(
      roomId,
      userId,
      serverConsumerId
    )

    await consumer.resume()

    return res.json({
      message: 'success',
    })
  } catch (error) {
    next(error)
  }
})

app.post('/clear-user', async (req, res, next) => {
  try {
    const mediasoupHandler = MediasoupHandler.getInstant(req)
    const { roomId, userId } = req.body

    const clearDataResp = mediasoupHandler.clearUser(roomId, userId)

    return res.json(clearDataResp)
  } catch (error) {
    next(error)
  }
})
