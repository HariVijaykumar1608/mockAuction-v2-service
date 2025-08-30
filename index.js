const { createServer } = require("http");
const { Server } = require("socket.io");
const { customAlphabet } = require("nanoid");
const { ObjectId } = require("mongodb");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Store members in each room
let roomData = [];
let roomMap = {}

// Quick lookup: socketId → roomCode
const userRoomMap = {};

io.on("connection", (socket) => {
  socket.on("create-room", (userData) => {
    const date = new Date()
    const nanoid = customAlphabet('0123456789', 4);
    const roomCode = nanoid();

    socket.join(roomCode);
    const roomId = new ObjectId()
    roomMap = { ...roomMap, [roomCode]: roomId };

    const userObj = {
      _id: new ObjectId(),
      socketId: socket.id,
      roomId,
      isActive: true,
      userName: userData.userName,
      team: userData.team,
      dateAndTime: date,
      role: "creator"
    }
    const roomObj = {
      _id : roomId,
      isActive : true,
      creationDateAndTime : date,
      roomCode,
      members : [userObj]
    }

    // const userObj = { ...userData, socketId: socket.id, isActive: true, createdDateAndTime : date, role : "creator", _id: roomId,};
    roomData.push(roomObj)
    // userRoomMap[socket.id] = roomCode;

    socket.emit("room-created", roomCode);
    socket.emit("userDetails",userObj)
    socket.emit("getAllRoomMembers", roomObj?.members || []);
  });

socket.on("join-room", (userData) => {
  const date = new Date();
  const options = [
    "CSK", "MI", "RCB", "KKR", "GT", "LSG", "SRH", "PBKS", "RR", "DC"
  ];
  const { roomCode, team, userName } = userData;

  const roomId = roomMap[roomCode]
  const room = roomData.find((obj) => obj._id.toString() === roomId.toString());
  const roomInfo = room?.members || [];

  if (roomInfo) {
    const teamExists = roomInfo.some((obj) => obj.team === team);

    if (teamExists) {
      let response = {
        msg: "Selected team has already been taken!!",
        option: options.filter((name) => name !== team),
      };
      socket.emit("joinRoomErrorHandling", response);
    } else {
      const userObj = {
        _id: new ObjectId(),
        socketId: socket.id,
        roomId,
        isActive: true,
        userName,
        team,
        dateAndTime: date,
        role: "member",
      };

      room.members.push(userObj);

      // replace room in roomData
      roomData = roomData.map((obj) =>
        obj._id.toString() === roomId.toString() ? room : obj
      );

      socket.join(roomCode);

      socket.emit("joined-room", roomCode);
      socket.emit("userDetails", userObj);
      io.to(roomCode).emit("getAllRoomMembers", room.members || []);
    }
  }
});


  socket.on("startAuction",(props) =>{
    const {roomCode,timer} = props
    io.to(roomCode).emit("auctionStarted", timer);

  })

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
