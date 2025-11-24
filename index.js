import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
// import { ObjectId } from "mongodb";
import { mongodbFunctions } from "./mongoDbFunctions.js";
import CreateRoom from "./createRoomSchema.js"
import dotenv from "dotenv";
dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

async function startServer() {
  mongodbFunctions.connectDb()
    .then(() => console.log("DB Connected"))
    .catch(err => console.error("DB Connection Error:", err));
}

startServer();

// Store members in each room
let roomData = [];
let roomMap = {}  //need to change to db

// Quick lookup: socketId → roomCode
const userRoomMap = {};

io.on("connection", (socket) => {
  socket.on("create-room", async (userData) => {
    const date = new Date().toISOString()
    const nanoid = customAlphabet('0123456789', 4);
    const roomCode = nanoid();

    socket.join(roomCode);
    // const roomId = new ObjectId()


    const userObj = {
      // _id: new ObjectId(),
      socketId: socket.id,
      // roomId,
      isActive: true,
      userName: userData.userName,
      team: userData.team,
      dateAndTime: date,
      role: "creator"
    }
    const roomObj = {
      // _id: roomId,
      isActive: true,
      creationDateAndTime: date,
      roomCode,
      members: [userObj]
    }

    // const userObj = { ...userData, socketId: socket.id, isActive: true, createdDateAndTime : date, role : "creator", _id: roomId,};
    // roomData.push(roomObj)
    const response = await CreateRoom.create(roomObj)
    console.log(response)
    response.members[0].roomId = response._id
    await response.save();
    roomMap = { ...roomMap, [roomCode]: response._id };
    // userRoomMap[socket.id] = roomCode;

    socket.emit("room-created", roomCode);
    socket.emit("userDetails", response.members[0])
    socket.emit("getAllRoomMembers", response?.members || []);
  });

  socket.on("join-room", async (userData) => {
    const date = new Date().toISOString()
    const options = [
      "CSK", "MI", "RCB", "KKR", "GT", "LSG", "SRH", "PBKS", "RR", "DC"
    ]; 
    const { roomCode, team, userName } = userData;

    const roomId = roomMap[roomCode]
    const response = await CreateRoom.findOne({_id:roomId})
    console.log(response)
    const roomInfo = response?.members || [];

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
          // _id: mongoose.Types.ObjectId,
          socketId: socket.id,
          roomId,
          isActive: true,
          userName,
          team,
          dateAndTime: date,
          role: "member",
        };

        response.members.push(userObj);

        await response.save();

        socket.join(roomCode);

        socket.emit("joined-room", roomCode);
        socket.emit("userDetails", userObj); //_id is not sended here
        io.to(roomCode).emit("getAllRoomMembers", response.members || []);
      }
    }
  });


  socket.on("startAuction", (props) => {
    const { roomCode, timer } = props
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
