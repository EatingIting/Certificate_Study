import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import mediasoup from "mediasoup";

// ===============================
// 기본 설정
// ===============================
const SFU_PORT = 4000;

// 로컬이면 null, 서버 배포 시 공인 IP를 넣어야 외부 접속이 됩니다.
const ANNOUNCED_IP = null;

// mediasoup codec
const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {},
  },
];

// ===============================
// mediasoup 전역 상태
// ===============================
let worker;

// roomId -> Room
const rooms = new Map();

/**
 * Room 구조:
 * {
 *   roomId,
 *   router,
 *   peers: Map(peerId -> Peer)
 * }
 *
 * Peer 구조:
 * {
 *   peerId,
 *   ws,
 *   transports: Map(transportId -> { transport, direction })
 *   producers: Map(producerId -> producer)
 *   consumers: Map(consumerId -> consumer)
 * }
 */

// ===============================
// 유틸
// ===============================
function safeSend(ws, obj) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcast(room, exceptPeerId, obj) {
  const msg = JSON.stringify(obj);
  for (const [pid, peer] of room.peers.entries()) {
    if (pid === exceptPeerId) continue;
    if (peer.ws?.readyState === peer.ws.OPEN) {
      peer.ws.send(msg);
    }
  }
}

function randomId(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

// ===============================
// Worker 생성
// ===============================
async function startWorker() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  worker.on("died", () => {
    console.error("❌ mediasoup worker died");
    process.exit(1);
  });

  console.log("✅ mediasoup worker created");
}

// ===============================
// Room 관리
// ===============================
async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (room) return room;

  const router = await worker.createRouter({ mediaCodecs });

  room = {
    roomId,
    router,
    peers: new Map(),
  };

  rooms.set(roomId, room);
  console.log(`🏠 room created: ${roomId}`);
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

  // close consumers
  for (const consumer of peer.consumers.values()) {
    try { consumer.close(); } catch {}
  }
  peer.consumers.clear();

  // close producers
  for (const producer of peer.producers.values()) {
    try { producer.close(); } catch {}
  }
  peer.producers.clear();

  // close transports
  for (const { transport } of peer.transports.values()) {
    try { transport.close(); } catch {}
  }
  peer.transports.clear();

  room.peers.delete(peerId);

  // 방이 비면 정리
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
      result.push({
        producerId,
        peerId: pid,
        kind: producer.kind,
      });
    }
  }
  return result;
}

// ===============================
// Express (헬스체크 정도만)
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

// ===============================
// WebSocket Signaling
// ===============================
const server = app.listen(SFU_PORT, async () => {
  await startWorker();
  console.log(`🚀 SFU server listening on http://localhost:${SFU_PORT}`);
});

const wss = new WebSocketServer({ server });

// 메시지 형식 (권장)
// Client -> Server
// { action: "join", data: { roomId, peerId? } , requestId }
// { action: "createTransport", data: { roomId, peerId, direction:"send"|"recv" } , requestId }
// { action: "connectTransport", data: { roomId, peerId, transportId, dtlsParameters }, requestId }
// { action: "produce", data: { roomId, peerId, transportId, kind, rtpParameters, appData? }, requestId }
// { action: "consume", data: { roomId, peerId, transportId, producerId, rtpCapabilities }, requestId }
// { action: "resumeConsumer", data: { roomId, peerId, consumerId }, requestId }
//
// Server -> Client
// { action: "<action>:response", requestId, data }
// { action: "<action>:error", requestId, error }
// 이벤트(push)
// { action: "newProducer", data: { roomId, peerId, producerId, kind } }
// { action: "producerClosed", data: { roomId, peerId, producerId } }
// { action: "peerLeft", data: { roomId, peerId } }

wss.on("connection", (ws) => {
  let joinedRoomId = null;
  let joinedPeerId = null;

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const { action, data, requestId } = msg;

    const reply = (payload) => safeSend(ws, { action: `${action}:response`, requestId, data: payload });
    const fail = (err) => safeSend(ws, { action: `${action}:error`, requestId, error: String(err?.message || err) });

    try {
      // -------------------------
      // join
      // -------------------------
      if (action === "join") {
        const { roomId, peerId } = data || {};
        if (!roomId) throw new Error("roomId required");

        const room = await getOrCreateRoom(roomId);

        const newPeerId = peerId || randomId("p_");
        // 동일 peerId가 이미 있으면 충돌 방지(간단 처리)
        if (room.peers.has(newPeerId)) throw new Error("peerId already exists in room");

        const peer = {
          peerId: newPeerId,
          ws,
          transports: new Map(), // transportId -> { transport, direction }
          producers: new Map(),  // producerId -> producer
          consumers: new Map(),  // consumerId -> consumer
        };

        room.peers.set(newPeerId, peer);

        joinedRoomId = roomId;
        joinedPeerId = newPeerId;

        // 기존 producer 목록을 함께 줘야 신규 참여자가 바로 consume 가능
        const existingProducers = listOtherProducers(room, newPeerId);

        reply({
          roomId,
          peerId: newPeerId,
          rtpCapabilities: room.router.rtpCapabilities,
          existingProducers,
        });

        return;
      }

      // join 이후만 허용
      if (!joinedRoomId || !joinedPeerId) {
        throw new Error("NOT_JOINED");
      }

      const room = rooms.get(joinedRoomId);
      if (!room) throw new Error("ROOM_NOT_FOUND");
      const peer = getPeer(room, joinedPeerId);

      // -------------------------
      // createTransport
      // -------------------------
      if (action === "createTransport") {
        const { direction } = data || {};
        if (direction !== "send" && direction !== "recv") {
          throw new Error("direction must be 'send' or 'recv'");
        }

        const transport = await room.router.createWebRtcTransport({
          listenIps: [
            {
              ip: "0.0.0.0",
              announcedIp: ANNOUNCED_IP || undefined,
            },
          ],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 800000,
        });

        peer.transports.set(transport.id, { transport, direction });

        transport.on("dtlsstatechange", (state) => {
          if (state === "closed") {
            try { transport.close(); } catch {}
            peer.transports.delete(transport.id);
          }
        });

        transport.on("close", () => {
          peer.transports.delete(transport.id);
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

      // -------------------------
      // connectTransport
      // -------------------------
      if (action === "connectTransport") {
        const { transportId, dtlsParameters } = data || {};
        if (!transportId || !dtlsParameters) throw new Error("transportId and dtlsParameters required");

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");

        await t.transport.connect({ dtlsParameters });
        reply({ connected: true });
        return;
      }

      // -------------------------
      // produce (sendTransport에서만)
      // -------------------------
      if (action === "produce") {
        const { transportId, kind, rtpParameters, appData } = data || {};
        if (!transportId || !kind || !rtpParameters) throw new Error("transportId/kind/rtpParameters required");

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");
        if (t.direction !== "send") throw new Error("NOT_A_SEND_TRANSPORT");

        const producer = await t.transport.produce({ kind, rtpParameters, appData });
        peer.producers.set(producer.id, producer);

        producer.on("transportclose", () => {
          peer.producers.delete(producer.id);
          // 다른 사람들에게 producer 종료 알림
          broadcast(room, peer.peerId, {
            action: "producerClosed",
            data: { roomId: room.roomId, peerId: peer.peerId, producerId: producer.id },
          });
        });

        producer.on("close", () => {
          peer.producers.delete(producer.id);
          broadcast(room, peer.peerId, {
            action: "producerClosed",
            data: { roomId: room.roomId, peerId: peer.peerId, producerId: producer.id },
          });
        });

        // 방 전체에 새 producer 알림 -> 다른 클라가 consume 호출
        broadcast(room, peer.peerId, {
          action: "newProducer",
          data: { roomId: room.roomId, peerId: peer.peerId, producerId: producer.id, kind: producer.kind },
        });

        reply({ producerId: producer.id });
        return;
      }

      // -------------------------
      // consume (recvTransport에서만)
      // -------------------------
      if (action === "consume") {
        const { transportId, producerId, rtpCapabilities } = data || {};
        if (!transportId || !producerId || !rtpCapabilities) {
          throw new Error("transportId/producerId/rtpCapabilities required");
        }

        const t = peer.transports.get(transportId);
        if (!t) throw new Error("TRANSPORT_NOT_FOUND");
        if (t.direction !== "recv") throw new Error("NOT_A_RECV_TRANSPORT");

        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error("CANNOT_CONSUME");
        }

        const consumer = await t.transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        peer.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          peer.consumers.delete(consumer.id);
        });

        consumer.on("producerclose", () => {
          peer.consumers.delete(consumer.id);
          // 클라가 해당 트랙 제거할 수 있도록 알려줌
          safeSend(ws, {
            action: "producerClosed",
            data: { roomId: room.roomId, producerId },
          });
        });

        reply({
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
        return;
      }

      // -------------------------
      // resumeConsumer
      // -------------------------
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

    // 브로드캐스트: 피어 나감
    broadcast(room, joinedPeerId, {
      action: "peerLeft",
      data: { roomId: joinedRoomId, peerId: joinedPeerId },
    });

    cleanupPeer(room, joinedPeerId);
  });
});
