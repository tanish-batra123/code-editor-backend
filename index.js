import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Actions } from "./actions.js";


const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH"],
    credentials: true,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH"],
    credentials: true,
  },
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        userName: userSocketMap[socketId],
      };
    },
  );
}

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on(Actions.JOIN, ({ roomId, userName }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(Actions.JOINED, {
        clients,
        userName,
        socketId: socket.id,
      });
    });


  });

   socket.on(Actions.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(Actions.CODE_CHANGE, { code });
    });


  socket.on(Actions.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(Actions.CODE_CHANGE, { code });
    });
    

   

  
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms].forEach((roomId) => {
      socket.in(roomId).emit(Actions.DISCONNECTED, {
        socketId: socket.id,
        userName: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

server.listen(PORT, () => {
  console.log(`server running on port: http://localhost:${PORT}`);
});
