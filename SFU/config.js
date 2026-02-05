// EC2 SFU 서버용 mediasoup 설정
// announcedIp는 환경변수 ANNOUNCED_IP로 덮어쓸 수 있음
export default {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
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
