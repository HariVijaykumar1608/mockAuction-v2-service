const { createServer } = require("http");
const { Server } = require("socket.io");
const { customAlphabet } = require("nanoid");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Store members in each room
const roomData = {};

// Quick lookup: socketId → roomCode
const userRoomMap = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create-room", (userData) => {
    const nanoid = customAlphabet('0123456789', 4);
    const roomCode = nanoid();

    socket.join(roomCode);

    const userObj = { ...userData, _id: socket.id, isActive: true };
    roomData[roomCode] = [userObj];
    userRoomMap[socket.id] = roomCode;

    socket.emit("room-created", roomCode);
    socket.emit("getAllRoomMembers", roomData[roomCode] || []);
  });

  socket.on("join-room", (userData) => {
    const options = [
      "CSK", "MI", "RCB", "KKR", "GT", "LSG", "SRH", "PBKS", "RR", "DC"
    ];
    const { roomCode, team, userName } = userData;
    const roomInfo = roomData[roomCode] || [];

    if (roomInfo) {
      const teamExists = roomInfo.some((obj) => obj.team === team);
      if (teamExists) {
        let response = {
          msg: "Selected team has Already taken!!",
          option: options.filter((name) => name !== team),
        };
        socket.emit("joinRoomErrorHandling", response);
      } else {
        const userObj = {
          userName,
          team,
          _id: socket.id,
          isActive: true
        };
        roomData[roomCode]?.push(userObj);
        userRoomMap[socket.id] = roomCode;

        socket.join(roomCode);
        socket.emit("joined-room", roomCode);
        io.to(roomCode).emit("getAllRoomMembers", roomData[roomCode] || []);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    const roomCode = userRoomMap[socket.id];
    if (!roomCode) return;

    const users = roomData[roomCode];
    if (!users) return;

    const userIndex = users.findIndex((u) => u._id === socket.id);
    if (userIndex !== -1) {
      roomData[roomCode][userIndex].isActive = false;
      io.to(roomCode).emit("getAllRoomMembers", roomData[roomCode]);
    }

    // cleanup mapping
    delete userRoomMap[socket.id];
  });
});

httpServer.listen(3000, () => {
  console.log("Server is running");
});
