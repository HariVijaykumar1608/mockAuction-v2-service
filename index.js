const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Store count for each room
const roomCounts = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create-room", () => {
    const roomCode = "1234"; // generate dynamically if needed
    socket.join(roomCode);

    // initialize count
    roomCounts[roomCode] = 0;

    socket.emit("room-created", roomCode);
  });

  socket.on("join-room", (roomCode) => {
    socket.join(roomCode);
    socket.emit("joined-room",roomCode)
    socket.emit("getCount", roomCounts[roomCode] || 0);
  });

  socket.on("increment", (roomCode) => {
    if (roomCounts[roomCode] !== undefined) {
      roomCounts[roomCode] += 1;
      io.to(roomCode).emit("getCount", roomCounts[roomCode]);
    }
  });

  socket.on("decrement", (roomCode) => {
    if (roomCounts[roomCode] !== undefined) {
      roomCounts[roomCode] -= 1;
      io.to(roomCode).emit("getCount", roomCounts[roomCode]);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

httpServer.listen(3000, () => {
  console.log("Server is running");
});
