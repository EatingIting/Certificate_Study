export default {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 40200,
  },

  webRtcTransport: {
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: process.env.ANNOUNCED_IP || "15.165.181.93",
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },
};
