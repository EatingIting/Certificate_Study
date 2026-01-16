import fs from "fs";
import https from "https";
import express from "express";
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws";
import mediasoup from "mediasoup";

const SFU_PORT = 4000;

// ✅ 맥북 같은 외부에서 붙을 때는 반드시 LAN IP를 announcedIp로 고정
const ANNOUNCED_IP = "172.30.1.250";

// ✅ 인증서 경로 (예: mkcert로 만든 파일)
const TLS_KEY_PATH = "./certs/172.30.1.250-key.pem";
const TLS_CERT_PATH = "./certs/172.30.1.250.pem";

// mediasoup codec
const mediaCodecs = [
  { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: {} },
];

let worker;
const rooms = new Map();

function safeSend(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcast(room, exceptPeerId, obj) {
  const msg = JSON.stringify(obj);
  for (const [pid, peer] of room.peers.entries()) {
    if (pid === exceptPeerId) continue;
    if (peer.ws && peer.ws.readyState === WebSocket.OPEN) peer.ws.send(msg);
  }
}

function randomId(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

async function startWorker() {
  worker = await mediasoup.createWorker({ rtcMinPort: 40000, rtcMaxPort: 49999 });
  worker.on("died", () => {
    console.error("❌ mediasoup worker died");
    process.exit(1);
  });
  console.log("✅ mediasoup worker created");
}

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (room) {
    console.log("🏠 [SFU] room exists:", roomId);
    return room;
  }

  console.log("🆕 [SFU] room CREATED:", roomId);
  const router = await worker.createRouter({ mediaCodecs });

  room = { roomId, router, peers: new Map() };
  rooms.set(roomId, room);

  return room;
}

function getPeer(room, peerId) {
  const peer = room?.peers?.get(peerId);
  if (!peer) throw new Error("PEER_NOT_FOUND");
  return peer;
}

function cleanupPeer(room, peerId) {
  const peer = room.peers.get(peerId);
  if (!peer) return;

  for (const consumer of peer.consumers.values()) { try { consumer.close(); } catch {} }
  peer.consumers.clear();

  for (const producer of peer.producers.values()) { try { producer.close(); } catch {} }
  peer.producers.clear();

  for (const { transport } of peer.transports.values()) { try { transport.close(); } catch {} }
  peer.transports.clear();

  room.peers.delete(peerId);

  if (room.peers.size === 0) {
    try { room.router.close(); } catch {}
    rooms.delete(room.roomId);
    console.log(`🧹 room removed: ${room.roomId}`);
  }
}

function listOtherProducers(room, exceptPeerId) {
  const result = [];
  for (const [pid, peer] of room.peers.entries()) {
    if (pid === exceptPeerId) continue;
    for (const producerId of peer.producers.keys()) {
      const producer = peer.producers.get(producerId);
      result.push({ producerId, peerId: pid, kind: producer.kind });
    }
  }
  return result;
}

// -------------------------------
// Express
// -------------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_, res) => res.json({ ok: true }));

// ✅ HTTPS 서버로 생성
const httpsServer = https.createServer({
  key: fs.readFileSync(TLS_KEY_PATH),
  cert: fs.readFileSync(TLS_CERT_PATH),
}, app);

// ✅ WSS 서버
const wss = new WebSocketServer({ server: httpsServer });

// ✅ 서버 시작
httpsServer.listen(SFU_PORT, async () => {
  await startWorker();
  console.log(`🚀 SFU HTTPS/WSS listening on https://${ANNOUNCED_IP}:${SFU_PORT}`);
});

// -------------------------------
// WebSocket Signaling (mediasoup control)
// -------------------------------
wss.on("connection", (ws) => {
  console.log("🔌 [SFU] WSS connected");

  let joinedRoomId = null;
  let joinedPeerId = null;

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const { action, data, requestId } = msg;

    const reply = (payload) => safeSend(ws, { action: `${action}:response`, requestId, data: payload });
    const fail = (err) => safeSend(ws, { action: `${action}:error`, requestId, error: String(err?.message || err) });

    try {
      if (action === "join") {
        const { roomId, peerId } = data || {};
        console.log("🚪 [SFU] JOIN REQUEST", { roomId, peerId, existingRooms: [...rooms.keys()] });

        if (!roomId) throw new Error("roomId required");

        const room = await getOrCreateRoom(roomId);
        const newPeerId = peerId || randomId("p_");

        if (room.peers.has(newPeerId)) throw new Error("peerId already exists in room");

        const peer = {
          peerId: newPeerId,
          ws,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };

        room.peers.set(newPeerId, peer);
        const count = room.peers.size;
        broadcast(room, null, { 
            action: "peerCount", 
            data: { count } 
        });

        console.log("👤 [SFU] peer joined", { roomId, peerId: newPeerId, peerCount: room.peers.size });

        joinedRoomId = roomId;
        joinedPeerId = newPeerId;

        const existingProducers = listOtherProducers(room, newPeerId);

        reply({
          roomId,
          peerId: newPeerId,
          rtpCapabilities: room.router.rtpCapabilities,
          existingProducers,
        });
        return;
      }

      if (!joinedRoomId || !joinedPeerId) throw new Error("NOT_JOINED");

      const room = rooms.get(joinedRoomId);
      if (!room) throw new Error("ROOM_NOT_FOUND");
      const peer = getPeer(room, joinedPeerId);

      if (action === "createTransport") {
        const { direction } = data || {};
        if (direction !== "send" && direction !== "recv") throw new Error("direction must be 'send' or 'recv'");

        const transport = await room.router.createWebRtcTransport({
          listenIps: [
            {
              ip: "0.0.0.0",
              announcedIp: "172.30.1.250"
            }
          ],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,

          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ]
        });

        peer.transports.set(transport.id, { transport, direction });

        transport.on("dtlsstatechange", (state) => {
          if (state === "closed") {
            try { transport.close(); } catch {}
            peer.transports.delete(transport.id);
          }
        });

        transport.on("close", () => peer.transports.delete(transport.id));

        reply({
          transportId: transport.id,
          direction,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
        return;
      }

      if (action === "connectTransport") {
        const { transportId, dtlsParameters } = data || {};
        if (!transportId || !dtlsParameters) throw new Error("transportId and dtlsParameters required");

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");

        await t.transport.connect({ dtlsParameters });
        reply({ connected: true });
        return;
      }

      if (action === "produce") {
        const { transportId, kind, rtpParameters, appData } = data || {};
        if (!transportId || !kind || !rtpParameters) throw new Error("transportId/kind/rtpParameters required");

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");
        if (t.direction !== "send") throw new Error("NOT_A_SEND_TRANSPORT");

        const producer = await t.transport.produce({ kind, rtpParameters, appData });
        peer.producers.set(producer.id, producer);

        const notifyClose = () => {
          peer.producers.delete(producer.id);
          broadcast(room, peer.peerId, {
            action: "producerClosed",
            data: { roomId: room.roomId, peerId: peer.peerId, producerId: producer.id },
          });
        };

        producer.on("transportclose", notifyClose);
        producer.on("close", notifyClose);

        broadcast(room, peer.peerId, {
          action: "newProducer",
          data: { roomId: room.roomId, peerId: peer.peerId, producerId: producer.id, kind: producer.kind },
        });

        reply({ producerId: producer.id });
        return;
      }

      if (action === "consume") {
        const { transportId, producerId, rtpCapabilities } = data || {};
        if (!transportId || !producerId || !rtpCapabilities) throw new Error("transportId/producerId/rtpCapabilities required");

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");
        if (t.direction !== "recv") throw new Error("NOT_A_RECV_TRANSPORT");

        if (!room.router.canConsume({ producerId, rtpCapabilities })) throw new Error("CANNOT_CONSUME");

        const consumer = await t.transport.consume({ producerId, rtpCapabilities, paused: true });
        peer.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => peer.consumers.delete(consumer.id));
        consumer.on("producerclose", () => {
          peer.consumers.delete(consumer.id);
          safeSend(ws, { action: "producerClosed", data: { roomId: room.roomId, producerId } });
        });

        reply({
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
        return;
      }

      if (action === "resumeConsumer") {
        const { consumerId } = data || {};
        if (!consumerId) throw new Error("consumerId required");

        const consumer = peer.consumers.get(consumerId);
        if (!consumer) throw new Error("CONSUMER_NOT_FOUND");

        await consumer.resume();
        reply({ resumed: true });
        return;
      }

      throw new Error(`UNKNOWN_ACTION: ${action}`);
    } catch (e) {
      fail(e);
    }
  });

  ws.on("close", () => {
    if (!joinedRoomId || !joinedPeerId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;

    broadcast(room, joinedPeerId, {
      action: "peerLeft",
      data: { roomId: joinedRoomId, peerId: joinedPeerId },
    });

    cleanupPeer(room, joinedPeerId);
    if (rooms.has(joinedRoomId)) { // 방이 아직 살아있다면
      const currentRoom = rooms.get(joinedRoomId);
      broadcast(currentRoom, null, { 
          action: "peerCount", 
          data: { count: currentRoom.peers.size } 
      });
    }
  });
});
