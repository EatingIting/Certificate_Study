/**
 * SFU 시그널링: HTTP/WS 전용 (인증서·.pem 파일 사용 안 함)
 * Spring ↔ SFU는 VPC 내부 ws:// 로만 연결
 */
import http from "http";
import express from "express";
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws";
import mediasoup from "mediasoup";
import os from "os";
import config from "./config.js";

const SFU_PORT = 4000;
const GRACE_MS = 15000; // 재접속 유예 (PiP/잠깐 끊김)

// Spring ↔ SFU 시그널링은 VPC 내부만 사용 → HTTP/WS (TLS 불필요)

// mediasoup codec
const mediaCodecs = [
  { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: {} },
];

let workers = [];
const rooms = new Map();
let shuttingDown = false;

function safeSend(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcast(room, exceptPeerId, obj) {
  const msg = JSON.stringify(obj);
  for (const [pid, peer] of [...room.peers.entries()]) {
    if (pid === exceptPeerId) continue;
    if (peer.ws && peer.ws.readyState === WebSocket.OPEN) peer.ws.send(msg);
  }
}

function randomId(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

const MY_IP = config.webRtcTransport.listenIps[0].announcedIp;
console.log(`📡 Announced IP (WebRTC): ${MY_IP}`);

async function startWorkers() {
  const numWorkers = Math.max(1, os.cpus().length);
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(config.worker);
    worker.on("died", () => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.error("❌ mediasoup worker died");
      try {
        for (const room of [...rooms.values()]) {
          for (const peerId of [...room.peers.keys()]) {
            cleanupPeer(room, peerId);
          }
          try { room.router.close(); } catch { }
        }
      } finally {
        process.exit(1);
      }
    });
    workers.push(worker);
  }
  console.log(`✅ mediasoup workers created: ${workers.length}`);
}

// 추후: worker별 roomCount 맵으로 최소 룸 수 워커에 배치 가능
function getNextWorker() {
  return workers[Math.floor(Math.random() * workers.length)];
}

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (room) {
    console.log("🏠 [SFU] room exists:", roomId);
    return room;
  }

  console.log("🆕 [SFU] room CREATED:", roomId);
  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs });
  router.on("close", () => {
    console.log("🧹 router closed", roomId);
  });

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

  if (peer.pendingCloseTimer) {
    clearTimeout(peer.pendingCloseTimer);
    peer.pendingCloseTimer = null;
  }

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

/** ws 끊김 시 유예 후 퇴장 (재접속 시 새 ws에도 close 핸들러 등록) */
function handlePeerDisconnect(room, peerId) {
  const peer = room.peers.get(peerId);
  if (!peer) return;

  // 이미 다른 ws로 재연결된 상태면 무시
  if (peer.ws && peer.ws.readyState === WebSocket.OPEN) return;

  peer.ws = null;
  peer.disconnectedAt = Date.now();

  if (peer.pendingCloseTimer) return;

  peer.pendingCloseTimer = setTimeout(() => {
    peer.pendingCloseTimer = null;
    // 유예 동안 재연결되면 취소
    if (peer.ws && peer.ws.readyState === WebSocket.OPEN) return;

    broadcast(room, peerId, {
      action: "peerLeft",
      data: { roomId: room.roomId, peerId },
    });
    cleanupPeer(room, peerId);
    if (rooms.has(room.roomId)) {
      const currentRoom = rooms.get(room.roomId);
      broadcast(currentRoom, null, {
        action: "peerCount",
        data: { count: currentRoom.peers.size },
      });
    }
  }, GRACE_MS);
}

function listOtherProducers(room, exceptPeerId) {
  const result = [];
  for (const [pid, peer] of [...room.peers.entries()]) {
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
app.get("/ready", (_, res) => {
  res.json({
    ok: workers.length > 0,
    workers: workers.length,
    rooms: rooms.size,
  });
});
app.get("/metrics", (_, res) => {
  let peers = 0, producers = 0, consumers = 0;
  for (const room of rooms.values()) {
    for (const peer of room.peers.values()) {
      peers++;
      producers += peer.producers.size;
      consumers += peer.consumers.size;
    }
  }
  res.json({
    rooms: rooms.size,
    peers,
    producers,
    consumers,
    workers: workers.length,
  });
});

// Spring만 접근 (보안그룹에서 TCP 4000은 Spring EC2만 허용 권장)
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(SFU_PORT, async () => {
  await startWorkers();
  console.log(`🚀 SFU HTTP/WS listening on http://${MY_IP}:${SFU_PORT}`);
});

function findProducerInfo(room, producerId) {
  for (const [pid, p] of [...room.peers.entries()]) {
    const producer = p.producers.get(producerId);
    if (producer) return { producer, peerId: pid };
  }
  return null;
}

// -------------------------------
// WebSocket Signaling (mediasoup control)
// -------------------------------
wss.on("connection", (ws) => {
  console.log("🔌 [SFU] WS connected");

  ws.on("error", (err) => {
    console.error("❌ [SFU] WS error:", err?.message || err);
  });

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

        // ✅ 같은 peerId가 이미 있으면 유예 중 재접속 → ws만 교체 (PiP 복귀/잠깐 끊김 대응)
        if (room.peers.has(newPeerId)) {
          const oldPeer = room.peers.get(newPeerId);
          if (oldPeer?.pendingCloseTimer) {
            clearTimeout(oldPeer.pendingCloseTimer);
            oldPeer.pendingCloseTimer = null;
          }
          // 기존 ws의 close 핸들러 제거 (중복 핸들러 방지)
          if (oldPeer.closeHandler && oldPeer.ws) {
            try { oldPeer.ws.off("close", oldPeer.closeHandler); } catch { }
          }
          oldPeer.ws = ws;
          oldPeer.disconnectedAt = null;
          const onClose = () => handlePeerDisconnect(room, newPeerId);
          oldPeer.closeHandler = onClose;
          ws.on("close", onClose);

          joinedRoomId = roomId;
          joinedPeerId = newPeerId;
          const existingProducers = listOtherProducers(room, newPeerId);
          console.log("🔄 [SFU] peer rejoined (same peerId)", { roomId, peerId: newPeerId });
          reply({
            roomId,
            peerId: newPeerId,
            rtpCapabilities: room.router.rtpCapabilities,
            existingProducers,
            rejoined: true,
          });
          return;
        }

        const peer = {
          peerId: newPeerId,
          ws,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
          pendingCloseTimer: null,
          disconnectedAt: null,
          closeHandler: null,
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

        for (const [pid, p] of [...room.peers.entries()]) {
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
          ...config.webRtcTransport,
          initialAvailableOutgoingBitrate: 1_000_000, // 1 Mbps 시작점
          // maxIncomingBitrate: 3_000_000, // 필요 시 제한
        });

        peer.transports.set(transport.id, { transport, direction });

        transport.on("icestatechange", (state) => {
          console.log(`[transport] ICE state: ${state} (${direction}, peerId: ${peer.peerId}, transportId: ${transport.id})`);
          if (state === "failed" || state === "disconnected") {
            console.error(`[transport] ICE ${state} - 연결 실패 가능성`, {
              peerId: peer.peerId,
              direction,
              transportId: transport.id,
              announcedIp: config.webRtcTransport.listenIps[0].announcedIp,
            });
          }
        });
        transport.on("dtlsstatechange", (state) => {
          console.log(`[transport] DTLS state: ${state} (${direction}, peerId: ${peer.peerId}, transportId: ${transport.id})`);
          if (state === "failed" || state === "closed") {
            console.error(`[transport] DTLS ${state}`, {
              peerId: peer.peerId,
              direction,
              transportId: transport.id,
            });
          }
          if (state === "closed") {
            try { transport.close(); } catch { }
            peer.transports.delete(transport.id);
          }
        });
        transport.on("close", () => peer.transports.delete(transport.id));

        console.log(`[transport] Created ${direction} transport`, {
          transportId: transport.id,
          peerId: peer.peerId,
          iceCandidatesCount: transport.iceCandidates?.length || 0,
          announcedIp: config.webRtcTransport.listenIps[0].announcedIp,
        });

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

        // 동일 kind/appData 기존 producer 정리 (카메라/마이크 토글 시 중복 방지)
        const appDataStr = JSON.stringify(appData || {});
        for (const p of [...peer.producers.values()]) {
          if (p.kind === kind && JSON.stringify(p.appData || {}) === appDataStr) {
            try { p.close(); } catch { }
            peer.producers.delete(p.id);
          }
        }

        const producer = await t.transport.produce({ kind, rtpParameters, appData });
        peer.producers.set(producer.id, producer);
        console.log(`[producer] Created ${kind} producer`, {
          producerId: producer.id,
          peerId: peer.peerId,
          roomId: room.roomId,
          appData: appData || {},
        });

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
        producer.on("score", (score) => {
          console.log("[producer] score", producer.id, score);
        });

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

        // paused: true 유지. 향후 Simulcast/SVC 시 preferedLayers / maxSpatialLayer 등 고려
        const consumer = await t.transport.consume({ producerId, rtpCapabilities, paused: true });
        peer.consumers.set(consumer.id, consumer);
        console.log(`[consumer] Created ${consumer.kind} consumer`, {
          consumerId: consumer.id,
          producerId,
          consumerPeerId: peer.peerId,
          producerPeerId,
          roomId: room.roomId,
        });

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
    handlePeerDisconnect(room, joinedPeerId);
  });
});