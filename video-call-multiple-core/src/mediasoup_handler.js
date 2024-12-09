import config from './config'
import * as mediasoup from 'mediasoup'

/**
 * @typedef {Object} RoomDetails
 * @property {Array} peers - Danh sách peers trong room.
 * @property {Array<TransportData>} consumerTransports - Danh sách consumerTransports trong room.
 * @property {Array<TransportData>} producerTransports - Danh sách producerTransports trong room.
 * @property {Array<ProducerData>} producers - Danh sách producers trong room.
 * @property {Array<ConsumerData>} consumers - Danh sách consumers trong room.
 * @property {mediasoup.types.Router} router - Router id trong room.
 */

/**
 * @typedef {Object} TransportData
 * @property {String} userId
 * @property {mediasoup.types.Transport} transport
 */

/**
 * @typedef {Object} ProducerData
 * @property {String} userId
 * @property {mediasoup.types.Transport} producer
 */

/**
 * @typedef {Object} ConsumerData
 * @property {String} userId
 * @property {mediasoup.types.Consumer} consumer
 */

/**
 * @typedef {Object} RtpCodec
 * @property {string} mimeType - Codec name, ví dụ: 'video/VP8'.
 * @property {number} payloadType - RTP payload type.
 * @property {number} clockRate - Clock rate của codec, ví dụ: 90000.
 */

/**
 * @typedef {Object} RtpParameters
 * @property {RtpCodec[]} codecs - Danh sách codec được hỗ trợ.
 * @property {Object[]} headerExtensions - Danh sách header extensions.
 * @property {Object[]} encodings - Danh sách các cấu hình encoding.
 * @property {Object} rtcp - Thông tin RTCP.
 */

/**
 * @typedef {Object} TransportProduceData
 * @property {String} producerId - id của producer
 * @property {Array<ProducerRespData>} producers - Danh sách userId.
 */

/**
 * @typedef {Object} ProducerRespData
 * @property {String} userId - id của producer
 * @property {String} producerId - Danh sách userId.
 */

/**
 * @typedef {Object} TransportConsumeData
 * @property {String} id - id của producer
 * @property {String} producerId - Danh sách userId.
 * @property {'audio' | 'video'} kind - Danh sách userId.
 * @property {RtpParameters} rtpParameters - Danh sách userId.
 */

class MediasoupHandler {
  /**
   * @constructor
   */
  constructor() {
    /** @type {mediasoup.types.Worker} */
    this.worker = null

    /**
     * @type {Map<string, RoomDetails>}
     */
    this.rooms = new Map()
  }

  /**
   * Tạo Worker của Mediasoup
   * @returns {Promise<mediasoup.types.Worker>} - Worker được tạo
   */
  async makeWorker() {
    console.log(config.mediasoup.workerSettings)

    this.worker = await mediasoup.createWorker(config.mediasoup.workerSettings)

    this.worker.on('died', (error) => {
      // This implies something serious happened, so kill the application
      console.error('mediasoup worker has died')
      setTimeout(() => process.exit(1), 2000) // exit in 2 seconds
    })

    return this.worker
  }

  /**
   * Tạo Router của Mediasoup
   * @param {String} roomId
   * @param {String} userId
   * @returns {Promise<mediasoup.types.Router>}
   */
  async getOrCreateRouter(roomId, userId) {
    if (!this.worker) {
      throw new Error('Worker chưa được tạo. Gọi createWorker trước.')
    }

    let router = null
    let room = this.rooms.get(roomId)
    if (room) {
      router = room.router
    } else {
      router = await this.worker.createRouter(config.mediasoup.routerOptions)
      room = new Map()
    }

    if (!room.peers) {
      room.peers = []
    }

    console.log(`Router ID: ${router.id}`, room.peers?.length)

    room.peers = [...room.peers, userId]
    room.router = router

    this.rooms.set(roomId, room)

    return router
  }

  /**
   * Tạo Transport WebRTC
   * @param {String} roomId
   * @param {String} userId
   * @param {'consumerTransports' | 'producerTransports'} transportType
   * @returns {Promise<mediasoup.types.WebRtcTransport>}
   */
  async createWebRtcTransport(roomId, userId, transportType) {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw new Error('room chưa được tạo. Tạo room trước.')
    }

    const transport = await room.router.createWebRtcTransport(
      config.mediasoup.webRtcServerOptions
    )

    console.log(`transport id: ${transport.id} - ${transportType}`)

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close()
      }
    })

    transport.on('close', () => {
      console.log('transport closed')
    })

    if (!room[transportType]) {
      room[transportType] = []
    }

    room[transportType].push({
      userId: userId,
      transport: transport,
    })

    return transport
  }

  /**
   * @param {String} roomId
   * @param {String} userId
   * @param {String} serverTransportId
   * @param {'consumerTransports' | 'producerTransports'} transportType
   * @returns {mediasoup.types.WebRtcTransport}
   */
  getTransport = (roomId, userId, serverTransportId, transportType) => {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw new Error('room chưa được tạo. Tạo room trước.')
    }

    console.log(`transport get id: ${serverTransportId} - ${transportType}`)

    const transportData = room[transportType].find(
      (transportData) =>
        transportData.transport.id === serverTransportId &&
        transportData.userId === userId
    )

    return transportData.transport
  }

  /**
   * @param {String} roomId
   * @param {String} userId
   * @param {'audio' | 'video'} kind - Loại media ('audio' hoặc 'video').
   * @param {RtpParameters} rtpParameters - Tham số RTP.
   * @param {String} serverTransportId
   * @returns {Promise<TransportProduceData>}
   */
  transportProduce = async (
    roomId,
    userId,
    serverTransportId,
    kind,
    rtpParameters
  ) => {
    const transport = this.getTransport(
      roomId,
      userId,
      serverTransportId,
      'producerTransports'
    )
    const room = this.rooms.get(roomId)
    const producer = await transport.produce({
      kind,
      rtpParameters,
    })

    if (!room.producers) {
      room.producers = []
    }

    const oldProducers = room.producers
      .map((producerData) => {
        if (producerData.userId !== userId) {
          return {
            producerId: producerData.producer.id,
            userId: producerData.userId,
          }
        }
      })
      .filter((data) => data !== null && data !== undefined)

    room.producers.push({ userId: userId, producer: producer })

    console.log('Producer ID: ', producer.id, producer.kind)

    producer.on('transportclose', () => {
      console.log('transport for this producer closed ')
      producer.close()
    })

    return {
      producerId: producer.id,
      producers: oldProducers,
    }
  }

  /**
   * @param {String} roomId
   * @param {String} userId
   * @param {String} serverTransportId
   * @returns {Promise<TransportConsumeData>}
   */
  transportConsume = async (
    roomId,
    userId,
    serverTransportId,
    rtpCapabilities,
    remoteProducerId
  ) => {
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error('room chưa được tạo. Tạo room trước.')
    }

    const transport = this.getTransport(
      roomId,
      userId,
      serverTransportId,
      'consumerTransports'
    )

    if (
      !room.router.canConsume({ producerId: remoteProducerId, rtpCapabilities })
    ) {
      return
    }

    const consumer = await transport.consume({
      producerId: remoteProducerId,
      rtpCapabilities,
      paused: true,
    })

    consumer.on('transportclose', () => {
      console.log('transport close from consumer')
    })

    consumer.on('producerclose', () => {
      console.log('producer of consumer closed')
      // socket.to(roomId).emit('producer-closed', { remoteProducerId })

      transport.close()

      room.consumerTransports = room.consumerTransports.filter(
        (transportData) => transportData.transport.id !== transport.id
      )

      consumer.close()

      room.consumers = room.consumers.filter(
        (consumerData) => consumerData.consumer.id !== consumer.id
      )
    })

    if (!room.consumers) {
      room.consumers = []
    }

    room.consumers.push({
      consumer: consumer,
      userId: userId,
    })

    // from the consumer extract the following params
    // to send back to the Client
    const params = {
      id: consumer.id,
      producerId: remoteProducerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    }

    return params
  }

  /**
   * @param {String} roomId
   * @param {String} userId
   * @param {String} serverConsumerId
   * @returns {mediasoup.types.Consumer}
   */
  getConsumer = (roomId, userId, serverConsumerId) => {
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error('room chưa được tạo. Tạo room trước.')
    }

    const consumerData = room.consumers.find(
      (consumerData) =>
        consumerData.consumer.id === serverConsumerId &&
        consumerData.userId === userId
    )

    return consumerData.consumer
  }

  removeItems = (items, userId, type) => {
    items.forEach((item) => {
      if (item.userId === userId) {
        item[type].close()
      }
    })
    items = items.filter((item) => item.userId !== userId)

    return items
  }

  /**
   * @param {String} roomId
   * @param {String} userId
   */
  clearUser = (roomId, userId) => {
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error('room chưa được tạo. Tạo room trước.')
    }
    room.consumerTransports = this.removeItems(
      room.consumerTransports,
      userId,
      'transport'
    )

    const producerIds = room.producers
      .filter((producerData) => producerData.userId === userId)
      .map((producerData) => producerData.producer.id)

    room.producerTransports = this.removeItems(
      room.producerTransports,
      userId,
      'transport'
    )

    room.consumers = this.removeItems(room.consumers, userId, 'consumer')
    room.producers = this.removeItems(room.producers, userId, 'producer')

    room.peers = room.peers.filter((peer) => peer !== userId)

    return {
      producerIds: producerIds,
      receivePeers: room.peers,
    }
  }

  /**
   *
   * @param {import('express').Request} request
   * @returns {MediasoupHandler}
   */
  static getInstant = (request) => {
    return request.app.get('mediasoupHandler')
  }
}

export default MediasoupHandler
