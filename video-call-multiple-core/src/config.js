const os = require('os')
const config = {
  // Listening hostname (just for `gulp live` task).
  domain: process.env.DOMAIN || 'localhost',
  // Signaling settings (protoo WebSocket server and HTTP API server).
  https: {
    listenIp: '0.0.0.0',
    // NOTE: Don't change listenPort (client app assumes 4443).
    listenPort: process.env.PROTOO_LISTEN_PORT || 4443,
    // NOTE: Set your own valid certificate files.
    tls: {
      cert:
        process.env.HTTPS_CERT_FULLCHAIN || `${__dirname}/certs/fullchain.pem`,
      key: process.env.HTTPS_CERT_PRIVKEY || `${__dirname}/certs/privkey.pem`,
    },
  },
  // mediasoup settings.
  mediasoup: {
    // Number of mediasoup workers to launch.
    numWorkers: Object.keys(os.cpus()).length,
    // mediasoup WorkerSettings.
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
    workerSettings: {
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        'rtx',
        'bwe',
        'score',
        'simulcast',
        'svc',
        'sctp',
      ],
      rtcMinPort: 4000,
      rtcMaxPort: 4999,
    },
    // mediasoup Router options.
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
    routerOptions: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
    // mediasoup WebRtcServer options for WebRTC endpoints (mediasoup-client,
    // libmediasoupclient).
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcServerOptions
    // NOTE: mediasoup-demo/server/lib/Room.js will increase this port for
    // each mediasoup Worker since each Worker is a separate process.
    webRtcServerOptions: {
      listenIps: [
        { ip: '127.0.0.1', announcedIp: null }, // Local IP
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
          announcedAddress:
            process.env.MEDIASOUP_ANNOUNCED_IP || '192.168.1.11',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
      ],
    },
  },
}

export default config
