import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Actions } from "./actions.js";

const app = express();

/* ================= CORS ================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://code-editor-frontend-hazel.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH"],
    credentials: true,
  })
);

/* ================= SERVER ================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/* ================= ROOM USERS ================= */

const userSocketMap = {};

/* get all users in room */
function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => ({
      socketId,
      userName: userSocketMap[socketId],
    })
  );
}

/* ================= SOCKET EVENTS ================= */

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  /* JOIN ROOM */
  socket.on(Actions.JOIN, ({ roomId, userName }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);

    // notify everyone
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(Actions.JOINED, {
        clients,
        userName,
        socketId: socket.id,
      });
    });
  });

  /* SYNC CODE (when new user joins) */
  socket.on(Actions.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(Actions.CODE_CHANGE, { code });
  });

  /* CODE CHANGE */
  socket.on(Actions.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(Actions.CODE_CHANGE, { code });
  });

  /* DISCONNECT */
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];

    rooms.forEach((roomId) => {
      socket.in(roomId).emit(Actions.DISCONNECTED, {
        socketId: socket.id,
        userName: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected:", socket.id);
  });
});

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
