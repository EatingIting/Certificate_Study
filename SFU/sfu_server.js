import fs from "fs";
import https from "https";
import express from "express";
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws";
import mediasoup from "mediasoup";
import os from "os";

const SFU_PORT = 4000;

// ✅ 인증서 경로 (예: mkcert로 만든 파일)
const TLS_KEY_PATH = "C:/certs/server-key.pem";
const TLS_CERT_PATH = "C:/certs/server.pem";

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

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4이고, 내부(127.0.0.1)가 아닌 주소를 찾음
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1"; // 못 찾으면 기본값
}

const MY_IP = getLocalIp(); // 서버 켜질 때 자동으로 IP 감지!
console.log(`📡 Detected Server IP: ${MY_IP}`);

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

  for (const consumer of peer.consumers.values()) { try { consumer.close(); } catch { } }
  peer.consumers.clear();

  for (const producer of peer.producers.values()) { try { producer.close(); } catch { } }
  peer.producers.clear();

  for (const { transport } of peer.transports.values()) { try { transport.close(); } catch { } }
  peer.transports.clear();

  room.peers.delete(peerId);

  if (room.peers.size === 0) {
    try { room.router.close(); } catch { }
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
      result.push({
        producerId,
        peerId: pid,
        kind: producer.kind,
        appData: producer.appData || {},
      });
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
  console.log(`🚀 SFU HTTPS/WSS listening on https://${MY_IP}:${SFU_PORT}`);
});

function findProducerInfo(room, producerId) {
  for (const [pid, p] of room.peers.entries()) {
    const producer = p.producers.get(producerId);
    if (producer) return { producer, peerId: pid };
  }
  return null;
}

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

        // ✅ 같은 peerId가 이미 있으면 기존 peer 정리 후 재연결 허용 (PIP 복귀 지원)
        if (room.peers.has(newPeerId)) {
          console.log(`🔄 [SFU] Peer ${newPeerId} already exists, cleaning up old connection...`);
          cleanupPeer(room, newPeerId);
        }

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

      if (action === "room:sync") {
        const peersState = [];
        const existingProducers = listOtherProducers(room, joinedPeerId);

        for (const [pid, p] of room.peers.entries()) {
          peersState.push({
            peerId: pid,
            micOn: [...p.producers.values()].some(prod => prod.kind === "audio"),
            cameraOn: [...p.producers.values()].some(prod => prod.kind === "video" && !prod.appData?.screen),
            screenOn: [...p.producers.values()].some(
              prod => prod.kind === "video" && prod.appData?.screen === true
            ),
          });
        }

        reply({
          peers: peersState,
          existingProducers,
        });
        return;
      }

      if (action === "createTransport") {
        const { direction } = data || {};
        if (direction !== "send" && direction !== "recv") throw new Error("direction must be 'send' or 'recv'");

        const transport = await room.router.createWebRtcTransport({
          listenIps: [
            {
              ip: "0.0.0.0",
              announcedIp: MY_IP,
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
            try { transport.close(); } catch { }
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
            data: {
              roomId: room.roomId,
              peerId: peer.peerId,
              producerId: producer.id,
              appData: producer.appData,
            },
          });
        };

        producer.on("transportclose", notifyClose);
        producer.on("close", notifyClose);

        broadcast(room, peer.peerId, {
          action: "newProducer",
          data: { roomId: room.roomId, peerId: peer.peerId, producerId: producer.id, kind: producer.kind, appData: producer.appData || {}, },
        });

        reply({ producerId: producer.id });
        return;
      }

      if (action === "consume") {
        const { transportId, producerId, rtpCapabilities } = data || {};

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");
        if (t.direction !== "recv") throw new Error("NOT_A_RECV_TRANSPORT");
        if (!room.router.canConsume({ producerId, rtpCapabilities })) throw new Error("CANNOT_CONSUME");

        const info = findProducerInfo(room, producerId);
        const appData = info?.producer?.appData || {};
        const producerPeerId = info?.peerId || null;

        const consumer = await t.transport.consume({ producerId, rtpCapabilities, paused: true });
        peer.consumers.set(consumer.id, consumer);

        // 비디오 consumer 생성 직후 키프레임 요청 → 상대방 화면 초반 화질 개선 (mediasoup Consumer API)
        if (consumer.kind === "video") {
          try {
            consumer.requestKeyFrame();
          } catch (_) {}
        }

        consumer.on("transportclose", () => peer.consumers.delete(consumer.id));
        consumer.on("producerclose", () => {
          peer.consumers.delete(consumer.id);
          safeSend(ws, {
            action: "producerClosed",
            data: { roomId: room.roomId, peerId: producerPeerId, producerId, appData },
          });
        });

        reply({
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          appData,
          peerId: producerPeerId,
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

      if (action === "closeProducer") {
        const { producerId } = data || {};
        const producer = peer.producers.get(producerId);

        if (producer) {
          const appData = producer.appData || {};
          producer.close();
          peer.producers.delete(producerId);

          // 다른 피어들에게 알림
          broadcast(room, joinedPeerId, {
            action: "producerClosed",
            data: {
              roomId: room.roomId,
              peerId: joinedPeerId,
              producerId,
              appData,
            },
          });
        }

        reply({ closed: true });
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